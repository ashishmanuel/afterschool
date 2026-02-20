import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Service role client bypasses RLS
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/timer-log
 * Log a timed activity for a ring slot
 * Body: { childId, ringSlot, minutes }
 */
export async function POST(request: NextRequest) {
  try {
    const { childId, ringSlot, minutes } = await request.json();

    if (!childId || !ringSlot || !minutes) {
      return NextResponse.json(
        { error: 'childId, ringSlot, and minutes are required' },
        { status: 400 }
      );
    }

    if (minutes <= 0 || minutes > 480) {
      return NextResponse.json(
        { error: 'Minutes must be between 1 and 480' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const today = new Date().toISOString().split('T')[0];
    const activityType = `ring_${ringSlot}`;

    // Calculate points (custom activities get 5 pts per 10 min)
    const pointsEarned = Math.floor((minutes * 5) / 10);

    // Insert activity log
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        child_id: childId,
        activity_type: activityType,
        minutes,
        points_earned: pointsEarned,
        logged_date: today,
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging timed activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: streak } = await supabase
      .from('streaks')
      .select('*')
      .eq('child_id', childId)
      .single();

    if (streak) {
      let newStreak = streak.current_streak;
      if (streak.last_active_date === yesterday) {
        newStreak += 1;
      } else if (streak.last_active_date !== today) {
        newStreak = 1;
      }

      await supabase
        .from('streaks')
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(streak.longest_streak, newStreak),
          last_active_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('child_id', childId);
    }

    return NextResponse.json({
      success: true,
      log: data,
      pointsEarned,
    });
  } catch (err) {
    console.error('Timer log POST error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
