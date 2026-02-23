'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { MiniRing } from '@/components/ui/ActivityRing';
import type { Child, Streak, RingAssignment } from '@/types/database';
import { getRingLabel, getRingIcon } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  date: string; // YYYY-MM-DD
  rings: { slot: number; percentage: number; color: string; label: string; minutes: number; goal: number }[];
  totalMinutes: number;
  hasActivity: boolean;
}

interface MonthData {
  year: number;
  month: number; // 0-indexed
  days: DayData[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sun
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [child, setChild] = useState<Child | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [ringAssignments, setRingAssignments] = useState<RingAssignment[]>([]);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  // ─── Load child profile + static data ──────────────────────────────────────
  const loadChild = useCallback(async () => {
    if (!profile?.id || !childId) return;
    try {
      const [childRes, streakRes, ringsRes, pointsRes] = await Promise.all([
        supabase.from('children').select('*').eq('id', childId).eq('parent_id', profile.id).single(),
        supabase.from('streaks').select('*').eq('child_id', childId).single(),
        supabase.from('ring_assignments').select('*').eq('child_id', childId).order('ring_slot'),
        supabase.from('activity_logs').select('points_earned').eq('child_id', childId),
      ]);

      if (!childRes.data) {
        // Not this parent's child — redirect
        router.replace('/dashboard');
        return;
      }

      setChild(childRes.data);
      setStreak(streakRes.data);
      setRingAssignments(ringsRes.data || []);
      setTotalPoints((pointsRes.data || []).reduce((s: number, l: { points_earned: number }) => s + l.points_earned, 0));
    } catch (err) {
      console.error('Error loading child:', err);
    }
  }, [childId, profile?.id]);

  // ─── Load calendar month data ───────────────────────────────────────────────
  const loadMonth = useCallback(async (year: number, month: number, rings: RingAssignment[]) => {
    if (!childId) return;

    // Build date range for the month
    const daysInMonth = getDaysInMonth(year, month);
    const startDate = toDateStr(year, month, 1);
    const endDate = toDateStr(year, month, daysInMonth);

    try {
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('activity_type, minutes, logged_date')
        .eq('child_id', childId)
        .gte('logged_date', startDate)
        .lte('logged_date', endDate);

      const allLogs = logs || [];

      // Build day data
      const days: DayData[] = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = toDateStr(year, month, day);
        const dayLogs = allLogs.filter((l) => l.logged_date === date);

        let ringData: DayData['rings'];

        if (rings.length > 0) {
          ringData = rings.map((ring) => {
            const ringKey = `ring_${ring.ring_slot}`;
            const minutes = dayLogs
              .filter((l) => l.activity_type === ringKey || (ring.subject && l.activity_type === ring.subject))
              .reduce((s, l) => s + l.minutes, 0);
            const goal = ring.daily_goal_minutes || 30;
            return {
              slot: ring.ring_slot,
              percentage: Math.min(Math.round((minutes / goal) * 100), 100),
              color: ring.color,
              label: getRingLabel(ring),
              minutes,
              goal,
            };
          });
        } else {
          // Fallback: math/reading/chores defaults
          const defaults = [
            { slot: 1, type: 'math', color: '#FF6B6B', label: 'Math' },
            { slot: 2, type: 'reading', color: '#4ECDC4', label: 'Reading' },
            { slot: 3, type: 'chores', color: '#6BCF7F', label: 'Chores' },
          ];
          ringData = defaults.map((d) => {
            const minutes = dayLogs.filter((l) => l.activity_type === d.type).reduce((s, l) => s + l.minutes, 0);
            return { slot: d.slot, percentage: Math.min(Math.round((minutes / 30) * 100), 100), color: d.color, label: d.label, minutes, goal: 30 };
          });
        }

        const totalMinutes = ringData.reduce((s, r) => s + r.minutes, 0);
        return { date, rings: ringData, totalMinutes, hasActivity: totalMinutes > 0 };
      });

      setMonthData({ year, month, days });
    } catch (err) {
      console.error('Error loading month data:', err);
      setMonthData({ year, month, days: [] });
    }
  }, [childId]);

  // ─── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.id) {
      router.replace('/login');
      return;
    }

    const init = async () => {
      try {
        await loadChild();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [authLoading, profile?.id]);

  // ─── Load month whenever month/year or rings change ─────────────────────────
  useEffect(() => {
    if (ringAssignments !== null) {
      loadMonth(viewYear, viewMonth, ringAssignments);
    }
  }, [viewYear, viewMonth, ringAssignments, loadMonth]);

  // ─── Navigation helpers ─────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    const today = new Date();
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return; // don't go future
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  // ─── Stat calculations ──────────────────────────────────────────────────────
  const activeDays = monthData?.days.filter((d) => d.hasActivity).length || 0;
  const totalMonthMinutes = monthData?.days.reduce((s, d) => s + d.totalMinutes, 0) || 0;
  const perfectDays = monthData?.days.filter(
    (d) => d.rings.length > 0 && d.rings.every((r) => r.percentage >= 100)
  ).length || 0;

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4 flame-pulse">🔥</div>
          <p className="text-[var(--muted)]">Loading track record...</p>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-mono text-2xl font-bold mb-2">Child not found</h2>
        <p className="text-[var(--muted)] mb-6">This child may not belong to your account.</p>
        <button onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0f0f0f]"
          style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-all text-sm"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{child.avatar_emoji}</span>
          <div>
            <h1 className="font-mono text-3xl font-bold">{child.name}</h1>
            <p className="text-sm text-[var(--muted)]">Grade {child.grade} · Age {child.age} · Full track record</p>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: '🔥', label: 'Current Streak',
            value: streak?.current_streak ? `${streak.current_streak}d` : '0d',
            sub: `Best: ${streak?.longest_streak ?? 0} days`,
            color: '#FF6B6B',
          },
          {
            icon: '⭐', label: 'Total Points',
            value: totalPoints.toLocaleString(),
            sub: 'All time',
            color: '#FFD93D',
          },
          {
            icon: '📅', label: 'Active Days',
            value: activeDays.toString(),
            sub: `This ${MONTH_NAMES[viewMonth].slice(0, 3)}`,
            color: '#4ECDC4',
          },
          {
            icon: '🏆', label: 'Perfect Days',
            value: perfectDays.toString(),
            sub: 'All rings complete',
            color: '#6BCF7F',
          },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className="font-mono text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* ── Calendar ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ←
              </button>
              <h2 className="font-mono text-lg font-bold">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-[var(--muted)] py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {monthData ? (
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before day 1 */}
                {Array.from({ length: getFirstDayOfMonth(viewYear, viewMonth) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {monthData.days.map((day) => {
                  const dayNum = parseInt(day.date.split('-')[2]);
                  const isToday = day.date === todayStr;
                  const isSelected = selectedDay?.date === day.date;
                  const isFuture = day.date > todayStr;
                  const hasPerfect = day.rings.length > 0 && day.rings.every((r) => r.percentage >= 100);

                  return (
                    <button
                      key={day.date}
                      onClick={() => !isFuture && setSelectedDay(isSelected ? null : day)}
                      disabled={isFuture}
                      className={`
                        relative flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all
                        ${isFuture ? 'opacity-20 cursor-not-allowed' : 'hover:bg-[var(--card-hover)] cursor-pointer'}
                        ${isSelected ? 'ring-2 ring-[#FF6B6B] bg-[#FF6B6B]/10' : ''}
                        ${isToday && !isSelected ? 'ring-1 ring-[#FFD93D]/60' : ''}
                      `}
                    >
                      {/* Perfect day crown */}
                      {hasPerfect && !isFuture && (
                        <span className="absolute -top-1 -right-0.5 text-[10px]">👑</span>
                      )}

                      {/* Day number */}
                      <span className={`text-xs font-bold leading-none ${
                        isToday ? 'text-[#FFD93D]' : 'text-[var(--foreground)]'
                      }`}>
                        {dayNum}
                      </span>

                      {/* Mini rings — stacked or shown as dots */}
                      {day.hasActivity && !isFuture ? (
                        <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                          {/* Outermost ring */}
                          {day.rings[0] && (
                            <MiniRing progress={day.rings[0].percentage} color={day.rings[0].color} size={28} />
                          )}
                          {/* Middle ring */}
                          {day.rings[1] && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <MiniRing progress={day.rings[1].percentage} color={day.rings[1].color} size={19} />
                            </div>
                          )}
                          {/* Inner ring */}
                          {day.rings[2] && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <MiniRing progress={day.rings[2].percentage} color={day.rings[2].color} size={11} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: 28, height: 28 }} className="flex items-center justify-center">
                          {!isFuture && (
                            <div className="w-4 h-4 rounded-full border border-[var(--border)] opacity-30" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--muted)] text-sm">Loading calendar...</div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border)] flex-wrap">
              <span className="text-xs text-[var(--muted)] font-semibold">Legend:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full border border-[var(--border)] opacity-40" />
                <span className="text-xs text-[var(--muted)]">No activity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative w-4 h-4">
                  <MiniRing progress={60} color="#FF6B6B" size={16} />
                </div>
                <span className="text-xs text-[var(--muted)]">Partial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative w-4 h-4">
                  <MiniRing progress={100} color="#6BCF7F" size={16} />
                </div>
                <span className="text-xs text-[var(--muted)]">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">👑</span>
                <span className="text-xs text-[var(--muted)]">All rings done</span>
              </div>
            </div>
          </div>

          {/* Month summary bar */}
          <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl px-6 py-4 flex gap-8 flex-wrap">
            <div>
              <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider mb-0.5">Month Total</p>
              <p className="font-mono text-2xl font-bold gradient-text">{totalMonthMinutes}m</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider mb-0.5">Active Days</p>
              <p className="font-mono text-2xl font-bold text-[#4ECDC4]">{activeDays}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider mb-0.5">Perfect Days</p>
              <p className="font-mono text-2xl font-bold text-[#6BCF7F]">{perfectDays}</p>
            </div>
            {streak && streak.current_streak > 0 && (
              <div>
                <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider mb-0.5">Streak</p>
                <p className="font-mono text-2xl font-bold text-[#FFD93D]">🔥 {streak.current_streak}d</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: day detail + ring assignments ─────────────────── */}
        <div className="space-y-6">
          {/* Day detail card */}
          {selectedDay ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-base font-bold">
                  {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>

              {selectedDay.hasActivity ? (
                <div className="space-y-4">
                  {selectedDay.rings.map((ring) => (
                    <div key={ring.slot}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{ring.label}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          ring.percentage >= 100
                            ? 'bg-[#6BCF7F]/20 text-[#6BCF7F]'
                            : ring.percentage > 0
                              ? 'bg-[#FFD93D]/20 text-[#FFD93D]'
                              : 'bg-[var(--card-hover)] text-[var(--muted)]'
                        }`}>
                          {ring.minutes}m / {ring.goal}m
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--card-hover)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${ring.percentage}%`, background: ring.color }}
                        />
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5 text-right">{ring.percentage}%</p>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-[var(--border)]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--muted)]">Total time</span>
                      <span className="font-mono text-sm font-bold">{selectedDay.totalMinutes}m</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">😴</div>
                  <p className="text-sm text-[var(--muted)]">No activity logged this day</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
              <div className="text-center py-4">
                <div className="text-3xl mb-2">👆</div>
                <p className="text-sm text-[var(--muted)]">Tap any day to see the breakdown</p>
              </div>
            </div>
          )}

          {/* Current Ring Assignments */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-mono text-base font-bold mb-4">Current Rings</h3>
            {ringAssignments.length > 0 ? (
              <div className="space-y-3">
                {ringAssignments.map((ring) => (
                  <div key={ring.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ring.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{getRingLabel(ring)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {getRingIcon(ring)} Goal: {ring.daily_goal_minutes}m/day
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)] capitalize flex-shrink-0">
                      Ring {ring.ring_slot}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No rings configured yet.</p>
            )}
          </div>

          {/* Streak card */}
          {streak && (
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(255,217,61,0.1), rgba(255,107,107,0.1))',
                border: '1px solid rgba(255,217,61,0.25)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl flame-pulse">🔥</span>
                <h3 className="font-mono text-base font-bold">Streak</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">Current</p>
                  <p className="font-mono text-2xl font-bold text-[#FFD93D]">{streak.current_streak}d</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">Best</p>
                  <p className="font-mono text-2xl font-bold text-[#FF6B6B]">{streak.longest_streak}d</p>
                </div>
              </div>
              {streak.last_active_date && (
                <p className="text-xs text-[var(--muted)] mt-2">
                  Last active: {new Date(streak.last_active_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
