import { createClient } from '@/lib/supabase';
import type {
  DailyProgress,
  RingAssignment,
  WeeklyRing,
} from '@/types/database';
import { getRingLabel, getRingIcon } from '@/types/database';
import { getModuleById, getNextModule, getAutoAssignModule } from '@/data/curriculum';

function getSupabase() {
  return createClient();
}

// ============================================
// RING ASSIGNMENTS
// ============================================

/** Fetch the 3 ring assignments for a child */
export async function getRingAssignments(childId: string): Promise<RingAssignment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ring_assignments')
    .select('*')
    .eq('child_id', childId)
    .order('ring_slot');

  if (error) {
    console.error('Error fetching ring assignments:', error);
    return [];
  }
  return data || [];
}

// ============================================
// DAILY PROGRESS (ring-aware)
// ============================================

/** Build daily progress from ring assignments + activity logs */
export async function getDailyProgress(childId: string): Promise<DailyProgress[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Fetch ring assignments and today's logs in parallel
  const [ringsRes, logsRes] = await Promise.all([
    supabase
      .from('ring_assignments')
      .select('*')
      .eq('child_id', childId)
      .order('ring_slot'),
    supabase
      .from('activity_logs')
      .select('activity_type, minutes')
      .eq('child_id', childId)
      .eq('logged_date', today),
  ]);

  const rings: RingAssignment[] = ringsRes.data || [];
  const logs = logsRes.data || [];

  // If no ring assignments exist yet, fall back to hardcoded defaults
  if (rings.length === 0) {
    return getDefaultDailyProgress(logs);
  }

  return rings.map((ring) => {
    // Activity type key for this ring: "ring_1", "ring_2", "ring_3"
    // OR legacy: "math", "reading", "chores"
    const ringKey = `ring_${ring.ring_slot}`;
    const legacyKey = ring.subject || ring.custom_label?.toLowerCase() || '';

    // Sum minutes from logs matching either ring key or legacy subject key
    const totalMinutes = logs
      .filter(
        (l) =>
          l.activity_type === ringKey ||
          l.activity_type === legacyKey ||
          (ring.subject && l.activity_type === ring.subject)
      )
      .reduce((sum, l) => sum + l.minutes, 0);

    const goalMinutes = ring.daily_goal_minutes || 30;

    return {
      ring_slot: ring.ring_slot,
      ring_label: getRingLabel(ring),
      ring_color: ring.color,
      ring_icon: getRingIcon(ring),
      activity_type: ringKey,
      total_minutes: totalMinutes,
      goal_minutes: goalMinutes,
      percentage: Math.min(Math.round((totalMinutes / goalMinutes) * 100), 100),
    };
  });
}

/** Fallback progress when no ring_assignments exist (pre-migration) */
function getDefaultDailyProgress(
  logs: { activity_type: string; minutes: number }[]
): DailyProgress[] {
  const defaults = [
    { slot: 1, type: 'math', label: 'Math', color: '#FF6B6B', icon: '📐' },
    { slot: 2, type: 'reading', label: 'Reading', color: '#4ECDC4', icon: '📖' },
    { slot: 3, type: 'chores', label: 'Chores', color: '#6BCF7F', icon: '🧹' },
  ];

  return defaults.map((d) => {
    const totalMinutes = logs
      .filter((l) => l.activity_type === d.type)
      .reduce((sum, l) => sum + l.minutes, 0);
    return {
      ring_slot: d.slot,
      ring_label: d.label,
      ring_color: d.color,
      ring_icon: d.icon,
      activity_type: d.type,
      total_minutes: totalMinutes,
      goal_minutes: 30,
      percentage: Math.min(Math.round((totalMinutes / 30) * 100), 100),
    };
  });
}

// ============================================
// WEEKLY PROGRESS (ring-aware)
// ============================================

export async function getWeeklyProgress(childId: string): Promise<WeeklyRing[]> {
  const supabase = getSupabase();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(d.toISOString().split('T')[0]);
  }

  const [ringsRes, logsRes] = await Promise.all([
    supabase
      .from('ring_assignments')
      .select('*')
      .eq('child_id', childId)
      .order('ring_slot'),
    supabase
      .from('activity_logs')
      .select('activity_type, minutes, logged_date')
      .eq('child_id', childId)
      .in('logged_date', dates),
  ]);

  const rings: RingAssignment[] = ringsRes.data || [];
  const logs = logsRes.data || [];

  // If no ring assignments, fall back to hardcoded
  if (rings.length === 0) {
    return getDefaultWeeklyProgress(dates, logs);
  }

  return dates.map((date) => {
    const dayLogs = logs.filter((l) => l.logged_date === date);

    const ringData = rings.map((ring) => {
      const ringKey = `ring_${ring.ring_slot}`;
      const totalMinutes = dayLogs
        .filter(
          (l) =>
            l.activity_type === ringKey ||
            (ring.subject && l.activity_type === ring.subject)
        )
        .reduce((sum, l) => sum + l.minutes, 0);
      const goal = ring.daily_goal_minutes || 30;

      return {
        slot: ring.ring_slot,
        percentage: Math.min(Math.round((totalMinutes / goal) * 100), 100),
        color: ring.color,
      };
    });

    return { date, rings: ringData };
  });
}

/** Fallback weekly progress pre-migration */
function getDefaultWeeklyProgress(
  dates: string[],
  logs: { activity_type: string; minutes: number; logged_date: string }[]
): WeeklyRing[] {
  const defaults = [
    { slot: 1, type: 'math', color: '#FF6B6B' },
    { slot: 2, type: 'reading', color: '#4ECDC4' },
    { slot: 3, type: 'chores', color: '#6BCF7F' },
  ];

  return dates.map((date) => {
    const dayLogs = logs.filter((l) => l.logged_date === date);
    const ringData = defaults.map((d) => {
      const mins = dayLogs
        .filter((l) => l.activity_type === d.type)
        .reduce((s, l) => s + l.minutes, 0);
      return {
        slot: d.slot,
        percentage: Math.min(Math.round((mins / 30) * 100), 100),
        color: d.color,
      };
    });
    return { date, rings: ringData };
  });
}

// ============================================
// LOG ACTIVITY (generic)
// ============================================

export async function logActivity(
  childId: string,
  activityType: string,
  minutes: number,
  lessonId?: string
) {
  const supabase = getSupabase();
  const pointsEarned = calculatePoints(minutes, activityType);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      child_id: childId,
      activity_type: activityType,
      minutes,
      points_earned: pointsEarned,
      lesson_id: lessonId || null,
      logged_date: today,
    })
    .select()
    .single();

  if (error) throw error;

  await updateStreak(childId);
  return data;
}

/** Log a timed activity for a specific ring slot */
export async function logTimedActivity(
  childId: string,
  ringSlot: number,
  minutes: number
) {
  // Use "ring_N" as the activity_type key
  return logActivity(childId, `ring_${ringSlot}`, minutes);
}

// ============================================
// POINTS CALCULATION
// ============================================

export function calculatePoints(minutes: number, activityType: string): number {
  // Known subjects get specific point rates; others get a default
  const basePoints: Record<string, number> = {
    math: 10,
    reading: 8,
    chores: 5,
    ring_1: 10, // curriculum rings get higher points
    ring_2: 8,
    ring_3: 5,
  };
  const rate = basePoints[activityType] || 6;
  return Math.floor((minutes * rate) / 10);
}

// ============================================
// TOTAL POINTS
// ============================================

export async function getTotalPoints(childId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('activity_logs')
    .select('points_earned')
    .eq('child_id', childId);

  return (data || []).reduce((sum, l) => sum + l.points_earned, 0);
}

// ============================================
// STREAK MANAGEMENT
// ============================================

export async function updateStreak(childId: string) {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const { data: todayLogs } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('child_id', childId)
    .eq('logged_date', today)
    .limit(1);

  if (!todayLogs?.length) return;

  const { data: streak } = await supabase
    .from('streaks')
    .select('*')
    .eq('child_id', childId)
    .single();

  if (!streak) return;

  let newStreak = streak.current_streak;

  if (streak.last_active_date === yesterday) {
    newStreak += 1;
  } else if (streak.last_active_date !== today) {
    newStreak = 1;
  }

  const longestStreak = Math.max(streak.longest_streak, newStreak);

  await supabase
    .from('streaks')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId);
}

// ============================================
// MODULE SKIP (placement quiz pass)
// ============================================

/** Mark a module as skipped via quiz, then advance the ring to the next module */
export async function skipModule(
  childId: string,
  moduleId: number,
  quizScore: number
): Promise<{ success: boolean; nextModuleId?: number; error?: string }> {
  const supabase = getSupabase();

  // 1. Upsert module_progress as skipped
  const { error: progressError } = await supabase
    .from('module_progress')
    .upsert(
      {
        child_id: childId,
        module_id: moduleId,
        current_chapter: 0,
        is_completed: true,
        skipped_via_quiz: true,
        quiz_score: quizScore,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'child_id,module_id' }
    );

  if (progressError) {
    console.error('Error updating module progress:', progressError);
    return { success: false, error: progressError.message };
  }

  // 2. Find which ring is assigned this module
  const { data: rings } = await supabase
    .from('ring_assignments')
    .select('*')
    .eq('child_id', childId)
    .eq('module_id', moduleId);

  const ring = rings?.[0];
  if (!ring) {
    return { success: true }; // Module skipped but no ring to update
  }

  // 3. Find the next module in the same subject
  const currentModule = getModuleById(moduleId);
  if (!currentModule) {
    return { success: true };
  }

  const nextModule = getNextModule(moduleId, currentModule.subject);

  if (nextModule) {
    // Update the ring to point to the next module
    await supabase
      .from('ring_assignments')
      .update({
        module_id: nextModule.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ring.id);

    return { success: true, nextModuleId: nextModule.id };
  }

  return { success: true }; // No next module — subject complete!
}

// ============================================
// AUTO-ASSIGN MODULE
// ============================================

/** Auto-assign the first grade-appropriate module for a ring */
export async function autoAssignModule(
  childId: string,
  ringSlot: number,
  grade: string,
  subject: string
): Promise<{ success: boolean; moduleId?: number; error?: string }> {
  const supabase = getSupabase();

  // Get completed module IDs for this child
  const { data: completedModules } = await supabase
    .from('module_progress')
    .select('module_id')
    .eq('child_id', childId)
    .eq('is_completed', true);

  const completedIds = (completedModules || []).map((m) => m.module_id);

  const module = getAutoAssignModule(grade, subject, completedIds);
  if (!module) {
    return { success: false, error: 'No available modules for this grade and subject' };
  }

  // Update the ring assignment
  const { error } = await supabase
    .from('ring_assignments')
    .update({
      ring_type: 'curriculum',
      module_id: module.id,
      subject,
      custom_label: null,
      custom_icon: null,
      auto_assigned: true,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)
    .eq('ring_slot', ringSlot);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, moduleId: module.id };
}
