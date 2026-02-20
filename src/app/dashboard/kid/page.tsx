'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { NestedActivityRings, MiniRing } from '@/components/ui/ActivityRing';
import Link from 'next/link';
import type { DailyProgress, Streak, WeeklyRing, RingAssignment, KidSession } from '@/types/database';
import { getRingLabel, getRingIcon } from '@/types/database';
import { getModuleById } from '@/data/curriculum';
import type { CurriculumModule } from '@/data/curriculum';

export default function KidDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<DailyProgress[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [weeklyRings, setWeeklyRings] = useState<WeeklyRing[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [ringAssignments, setRingAssignments] = useState<RingAssignment[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childEmoji, setChildEmoji] = useState('🧒');
  const [loading, setLoading] = useState(true);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  // Timer state (for custom timed ring)
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showManualLog, setShowManualLog] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [timerRingSlot, setTimerRingSlot] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (dashboardLoaded) return;
    const kidSessionStr = localStorage.getItem('kid_session');
    if (kidSessionStr) {
      loadDashboard();
      return;
    }
    if (!authLoading) {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, dashboardLoaded]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  async function loadDashboard() {
    let resolvedChildId: string | null = null;
    let resolvedName = '';
    let resolvedEmoji = '🧒';

    const kidSessionStr = localStorage.getItem('kid_session');
    if (kidSessionStr) {
      try {
        const kidSession: KidSession = JSON.parse(kidSessionStr);
        resolvedChildId = kidSession.child_id;
        resolvedName = kidSession.child_name;
        resolvedEmoji = kidSession.avatar_emoji;
      } catch {
        localStorage.removeItem('kid_session');
      }
    }

    if (!resolvedChildId && profile?.id) {
      const { data: children } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', profile.id)
        .limit(1);

      const child = children?.[0];
      if (child) {
        resolvedChildId = child.id;
        resolvedName = child.name;
        resolvedEmoji = child.avatar_emoji;
      }
    }

    if (!resolvedChildId) {
      if (!profile) {
        window.location.href = '/kid-login';
        return;
      }
      setLoading(false);
      return;
    }

    setChildId(resolvedChildId);
    setChildName(resolvedName);
    setChildEmoji(resolvedEmoji);

    const today = new Date().toISOString().split('T')[0];

    // Load all data in parallel
    const [streakRes, logsRes, ringsRes, pointsRes] = await Promise.all([
      supabase.from('streaks').select('*').eq('child_id', resolvedChildId).single(),
      supabase.from('activity_logs').select('activity_type, minutes').eq('child_id', resolvedChildId).eq('logged_date', today),
      supabase.from('ring_assignments').select('*').eq('child_id', resolvedChildId).order('ring_slot'),
      supabase.from('activity_logs').select('points_earned').eq('child_id', resolvedChildId),
    ]);

    setStreak(streakRes.data);
    const rings: RingAssignment[] = ringsRes.data || [];
    setRingAssignments(rings);
    const logs = logsRes.data || [];

    // Build daily progress from ring assignments
    let dailyProgress: DailyProgress[];
    if (rings.length > 0) {
      dailyProgress = rings.map((ring) => {
        const ringKey = `ring_${ring.ring_slot}`;
        const totalMinutes = logs
          .filter(
            (l) =>
              l.activity_type === ringKey ||
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
    } else {
      // Fallback
      const defaults = [
        { type: 'math', label: 'Math', color: '#FF6B6B', icon: '📐' },
        { type: 'reading', label: 'Reading', color: '#4ECDC4', icon: '📖' },
        { type: 'chores', label: 'Chores', color: '#6BCF7F', icon: '🧹' },
      ];
      dailyProgress = defaults.map((d, i) => {
        const totalMinutes = logs
          .filter((l) => l.activity_type === d.type)
          .reduce((sum, l) => sum + l.minutes, 0);
        return {
          ring_slot: i + 1,
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
    setProgress(dailyProgress);

    // Total points
    setTotalPoints((pointsRes.data || []).reduce((s, l) => s + l.points_earned, 0));

    // Weekly rings (last 7 days)
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(new Date(Date.now() - i * 86400000).toISOString().split('T')[0]);
    }

    const { data: weekLogs } = await supabase
      .from('activity_logs')
      .select('activity_type, minutes, logged_date')
      .eq('child_id', resolvedChildId)
      .in('logged_date', dates);

    const weekly: WeeklyRing[] = dates.map((date) => {
      const dayLogs = (weekLogs || []).filter((l) => l.logged_date === date);

      if (rings.length > 0) {
        const ringData = rings.map((ring) => {
          const ringKey = `ring_${ring.ring_slot}`;
          const mins = dayLogs
            .filter((l) => l.activity_type === ringKey || (ring.subject && l.activity_type === ring.subject))
            .reduce((s, l) => s + l.minutes, 0);
          const goal = ring.daily_goal_minutes || 30;
          return {
            slot: ring.ring_slot,
            percentage: Math.min(Math.round((mins / goal) * 100), 100),
            color: ring.color,
          };
        });
        return { date, rings: ringData };
      } else {
        // Fallback
        const getPercent = (type: string) => {
          const mins = dayLogs.filter((l) => l.activity_type === type).reduce((s, l) => s + l.minutes, 0);
          return Math.min(Math.round((mins / 30) * 100), 100);
        };
        return {
          date,
          rings: [
            { slot: 1, percentage: getPercent('math'), color: '#FF6B6B' },
            { slot: 2, percentage: getPercent('reading'), color: '#4ECDC4' },
            { slot: 3, percentage: getPercent('chores'), color: '#6BCF7F' },
          ],
        };
      }
    });
    setWeeklyRings(weekly);

    setDashboardLoaded(true);
    setLoading(false);
  }

  function handleKidLogout() {
    localStorage.removeItem('kid_session');
    window.location.href = '/kid-login';
  }

  // Timer controls
  const startTimer = useCallback((ringSlot: number) => {
    setTimerRingSlot(ringSlot);
    setTimerSeconds(0);
    setTimerRunning(true);
  }, []);

  const stopTimer = useCallback(async () => {
    setTimerRunning(false);
    const minutes = Math.max(1, Math.round(timerSeconds / 60));

    if (childId && timerRingSlot) {
      try {
        await fetch('/api/timer-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            ringSlot: timerRingSlot,
            minutes,
          }),
        });
        // Reload dashboard to show updated progress
        setDashboardLoaded(false);
      } catch (err) {
        console.error('Error logging timer:', err);
      }
    }

    setTimerSeconds(0);
    setTimerRingSlot(null);
  }, [childId, timerRingSlot, timerSeconds]);

  const submitManualLog = useCallback(async (ringSlot: number) => {
    const mins = parseInt(manualMinutes);
    if (!mins || mins <= 0 || !childId) return;

    try {
      await fetch('/api/timer-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          ringSlot,
          minutes: mins,
        }),
      });
      setManualMinutes('');
      setShowManualLog(false);
      setDashboardLoaded(false);
    } catch (err) {
      console.error('Error logging manual time:', err);
    }
  }, [childId, manualMinutes]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get module cards from ring assignments
  const moduleCards: { ring: RingAssignment; module: CurriculumModule | undefined }[] =
    ringAssignments
      .filter((r) => r.ring_type === 'curriculum' && r.module_id)
      .map((r) => ({ ring: r, module: getModuleById(r.module_id!) }));

  const customTimedRings = ringAssignments.filter((r) => r.ring_type === 'custom_timed');

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4 flame-pulse">🔥</div>
          <p className="text-[var(--muted)]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!childId) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🧒</div>
        <h2 className="font-mono text-2xl font-bold mb-2">No child profile found</h2>
        <p className="text-[var(--muted)]">Ask a parent to add you to their account.</p>
      </div>
    );
  }

  const isKidSession = !!localStorage.getItem('kid_session');

  return (
    <div>
      {/* Kid Welcome Header */}
      {isKidSession && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{childEmoji}</span>
            <div>
              <h1 className="font-mono text-2xl font-bold">Hi, {childName}!</h1>
              <p className="text-sm text-[var(--muted)]">Ready to learn something awesome?</p>
            </div>
          </div>
          <button
            onClick={handleKidLogout}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-all"
          >
            Log out
          </button>
        </div>
      )}

      {/* Streak Banner */}
      {streak && streak.current_streak > 0 && (
        <div
          className="rounded-xl p-5 flex items-center gap-4 mb-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 217, 61, 0.15), rgba(255, 107, 107, 0.15))',
            border: '1px solid rgba(255, 217, 61, 0.3)',
          }}
        >
          <span className="text-4xl flame-pulse">🔥</span>
          <div>
            <span className="text-lg font-bold">{streak.current_streak} Day Streak!</span>
            <p className="text-sm text-[var(--muted)]">
              Keep it up! Best streak: {streak.longest_streak} days
            </p>
          </div>
        </div>
      )}

      {/* Weekly Activity + Points row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Weekly Activity — dynamic rings */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4">
            This Week
          </h2>
          <div className="flex justify-between items-end">
            {weeklyRings.map((day) => {
              const d = new Date(day.date + 'T00:00:00');
              const isToday = day.date === new Date().toISOString().split('T')[0];
              // Get the outer and inner ring data
              const outerRing = day.rings[0];
              const innerRing = day.rings.length > 1 ? day.rings[1] : null;

              return (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <MiniRing
                      progress={outerRing?.percentage || 0}
                      color={outerRing?.color || '#FF6B6B'}
                      size={32}
                    />
                    {innerRing && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MiniRing
                          progress={innerRing.percentage}
                          color={innerRing.color}
                          size={20}
                        />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? 'text-[#FF6B6B]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {dayNames[d.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Points Showcase */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-4">
            Points
          </h2>
          <div className="text-center">
            <p className="font-mono text-5xl font-bold gradient-text mb-1">
              {totalPoints.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--muted)]">Total points earned</p>
          </div>
        </div>
      </div>

      {/* Today's Rings + Module/Activity Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Rings — dynamic */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center justify-center">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-6">
            {"Today's Progress"}
          </h2>
          <NestedActivityRings
            rings={progress.map((p) => ({
              progress: p.percentage,
              color: p.ring_color,
              label: p.ring_label,
              icon: p.ring_icon,
            }))}
            size={220}
          />
          <div className="mt-6 grid grid-cols-3 gap-4 w-full">
            {progress.map((p) => (
              <div key={p.ring_slot} className="text-center">
                <p className="font-mono text-lg font-bold">
                  {p.total_minutes}
                  <span className="text-xs text-[var(--muted)]">/{p.goal_minutes}m</span>
                </p>
                <p className="text-xs text-[var(--muted)]">{p.ring_label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Module Cards + Timer Widget */}
        <div className="lg:col-span-2">
          <h2 className="font-mono text-xl font-bold mb-6">Your Assignments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Curriculum Module Cards */}
            {moduleCards.map(({ ring, module }) => (
              <div
                key={ring.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: ring.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Ring {ring.ring_slot} &middot; {getRingLabel(ring)}
                  </span>
                </div>
                <span className="text-3xl mb-3 block">{module?.icon || '📚'}</span>
                <h3 className="font-semibold mb-1">{module?.title || 'Module'}</h3>
                <p className="text-xs text-[var(--muted)] mb-3">
                  {module?.grades} &middot; {module?.duration} &middot; {module?.activities} activities
                </p>

                {/* Chapter list preview */}
                {module?.chapters && (
                  <div className="space-y-1 mb-4">
                    {module.chapters.slice(0, 3).map((ch, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-5 h-5 rounded-full bg-[var(--card-hover)] flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span className="text-[var(--muted)]">{ch}</span>
                      </div>
                    ))}
                    {module.chapters.length > 3 && (
                      <p className="text-xs text-[var(--muted)] pl-7">
                        +{module.chapters.length - 3} more chapters
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href="/lessons"
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-center text-[#0f0f0f]"
                    style={{ background: ring.color }}
                  >
                    Start Learning
                  </Link>
                  <Link
                    href={`/dashboard/kid/quiz/${module?.id || ring.module_id}`}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Skip Ahead ⚡
                  </Link>
                </div>
              </div>
            ))}

            {/* Custom Timed Activity Cards */}
            {customTimedRings.map((ring) => (
              <div
                key={ring.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: ring.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Ring {ring.ring_slot} &middot; Timed Activity
                  </span>
                </div>
                <span className="text-3xl mb-3 block">{getRingIcon(ring)}</span>
                <h3 className="font-semibold mb-1">{getRingLabel(ring)}</h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Goal: {ring.daily_goal_minutes} minutes today
                </p>

                {/* Timer Widget */}
                {timerRunning && timerRingSlot === ring.ring_slot ? (
                  <div className="text-center">
                    <p className="font-mono text-4xl font-bold mb-4" style={{ color: ring.color }}>
                      {formatTimer(timerSeconds)}
                    </p>
                    <button
                      onClick={stopTimer}
                      className="w-full py-3 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      ⏹ Stop & Log Time
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => startTimer(ring.ring_slot)}
                      className="w-full py-3 rounded-lg text-sm font-semibold text-[#0f0f0f]"
                      style={{ background: ring.color }}
                    >
                      ▶ Start Timer
                    </button>

                    {showManualLog && timerRingSlot === ring.ring_slot ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={manualMinutes}
                          onChange={(e) => setManualMinutes(e.target.value)}
                          placeholder="Minutes"
                          min="1"
                          max="480"
                          className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm text-center focus:outline-none focus:border-[#4ECDC4]"
                        />
                        <button
                          onClick={() => submitManualLog(ring.ring_slot)}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#4ECDC4]/20 text-[#4ECDC4] hover:bg-[#4ECDC4]/30 transition-colors"
                        >
                          Log
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setTimerRingSlot(ring.ring_slot);
                          setShowManualLog(true);
                        }}
                        className="w-full py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        Or log minutes manually
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Empty state if no assignments */}
            {moduleCards.length === 0 && customTimedRings.length === 0 && (
              <>
                <Link
                  href="/lessons"
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all block"
                >
                  <span className="text-3xl mb-3 block">📐</span>
                  <h3 className="font-semibold mb-1">5th Grade Math - Decimals</h3>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    Understanding decimal place value with real-world scenarios
                  </p>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--card-hover)] text-[var(--muted)]">30m</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[#6BCF7F]/20 text-[#6BCF7F]">+25 pts</span>
                  </div>
                </Link>
                <Link
                  href="/lessons"
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all block"
                >
                  <span className="text-3xl mb-3 block">🕵️</span>
                  <h3 className="font-semibold mb-1">Reading Detectives</h3>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    Find the main idea with detective-style investigations
                  </p>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--card-hover)] text-[var(--muted)]">30m</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[#6BCF7F]/20 text-[#6BCF7F]">+20 pts</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
