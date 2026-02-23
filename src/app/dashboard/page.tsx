'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import ActivityRing from '@/components/ui/ActivityRing';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Child, Streak, DailyProgress, RingAssignment } from '@/types/database';
import { getRingLabel, getRingIcon } from '@/types/database';
import { CURRICULUM_CATALOG, getModulesForGrade, matchesGrade } from '@/data/curriculum';

interface ChildData extends Child {
  streak: Streak | null;
  progress: DailyProgress[];
  totalPoints: number;
  ringAssignments: RingAssignment[];
}

// Ring configuration state for the modal
interface RingConfigState {
  slot: 1 | 2 | 3;
  ring_type: 'curriculum' | 'custom_timed';
  subject: string;
  module_id: number | null;
  custom_label: string;
  custom_icon: string;
  color: string;
  daily_goal_minutes: number;
}

export default function ParentDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('6');
  const [newChildGrade, setNewChildGrade] = useState('K');
  const [newChildEmoji, setNewChildEmoji] = useState('🧒');
  const [newChildPin, setNewChildPin] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);

  // Ring config modal state
  const [configChild, setConfigChild] = useState<ChildData | null>(null);
  const [configRings, setConfigRings] = useState<RingConfigState[]>([]);
  const [configSaving, setConfigSaving] = useState(false);

  const supabase = createClient();
  const kidEmojis = ['🧒', '👦', '👧', '🧒🏽', '👦🏽', '👧🏽', '🧒🏿', '👦🏿', '👧🏿'];

  useEffect(() => {
    if (authLoading) return; // Wait for auth to settle first
    if (profile?.id) {
      loadChildren();
    } else {
      // Auth resolved but no profile — nothing to load
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.id]);

  async function loadChildren() {
    if (!profile?.id) return;

    try {
      const { data: kids } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', profile.id)
        .order('created_at');

      if (!kids || kids.length === 0) {
        setChildren([]);
        return;
      }

      const childrenWithData: ChildData[] = await Promise.all(
        kids.map(async (child) => {
          const today = new Date().toISOString().split('T')[0];

          const [streakRes, logsRes, ringsRes, pointsRes] = await Promise.all([
            supabase.from('streaks').select('*').eq('child_id', child.id).single(),
            supabase.from('activity_logs').select('activity_type, minutes').eq('child_id', child.id).eq('logged_date', today),
            supabase.from('ring_assignments').select('*').eq('child_id', child.id).order('ring_slot'),
            supabase.from('activity_logs').select('points_earned').eq('child_id', child.id),
          ]);

          const rings: RingAssignment[] = ringsRes.data || [];
          const logs = logsRes.data || [];

          // Build progress from ring assignments (or fallback to defaults)
          let progress: DailyProgress[];
          if (rings.length > 0) {
            progress = rings.map((ring) => {
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
            // Fallback for pre-migration children
            const defaults = [
              { type: 'math', label: 'Math', color: '#FF6B6B', icon: '📐' },
              { type: 'reading', label: 'Reading', color: '#4ECDC4', icon: '📖' },
              { type: 'chores', label: 'Chores', color: '#6BCF7F', icon: '🧹' },
            ];
            progress = defaults.map((d, i) => {
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

          const totalPoints = (pointsRes.data || []).reduce((s, l) => s + l.points_earned, 0);
          return { ...child, streak: streakRes.data, progress, totalPoints, ringAssignments: rings };
        })
      );

      setChildren(childrenWithData);
    } catch (err) {
      console.error('Error loading children:', err);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setSaving(true);

    if (newChildPin.length !== 4 || !/^\d{4}$/.test(newChildPin)) {
      setAddError('PIN must be exactly 4 digits.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChildName,
          age: newChildAge,
          grade: newChildGrade,
          avatar_emoji: newChildEmoji,
          kid_pin: newChildPin,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        console.error('Error adding child:', result);
        setAddError(result.error || 'Failed to add child. Please try again.');
        return;
      }

      setNewChildName('');
      setNewChildPin('');
      setNewChildEmoji('🧒');
      setNewChildAge('6');
      setNewChildGrade('K');
      setShowAddChild(false);
      loadChildren();
    } catch {
      setAddError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // RING CONFIG MODAL LOGIC
  // ============================================

  function openRingConfig(child: ChildData) {
    setConfigChild(child);

    if (child.ringAssignments.length > 0) {
      setConfigRings(
        child.ringAssignments.map((r) => ({
          slot: r.ring_slot as 1 | 2 | 3,
          ring_type: r.ring_type as 'curriculum' | 'custom_timed',
          subject: r.subject || 'math',
          module_id: r.module_id,
          custom_label: r.custom_label || '',
          custom_icon: r.custom_icon || '⏱️',
          color: r.color,
          daily_goal_minutes: r.daily_goal_minutes,
        }))
      );
    } else {
      setConfigRings([
        { slot: 1, ring_type: 'curriculum', subject: 'math', module_id: null, custom_label: '', custom_icon: '⏱️', color: '#FF6B6B', daily_goal_minutes: 30 },
        { slot: 2, ring_type: 'curriculum', subject: 'reading', module_id: null, custom_label: '', custom_icon: '⏱️', color: '#4ECDC4', daily_goal_minutes: 30 },
        { slot: 3, ring_type: 'custom_timed', subject: '', module_id: null, custom_label: 'Free Activity', custom_icon: '🎯', color: '#6BCF7F', daily_goal_minutes: 30 },
      ]);
    }
  }

  function updateRingConfig(slot: number, updates: Partial<RingConfigState>) {
    setConfigRings((prev) =>
      prev.map((r) => (r.slot === slot ? { ...r, ...updates } : r))
    );
  }

  function handleAutoAssign(slot: number, subject: string) {
    if (!configChild) return;
    const modules = getModulesForGrade(configChild.grade, subject);
    if (modules.length > 0) {
      updateRingConfig(slot, {
        ring_type: 'curriculum',
        subject,
        module_id: modules[0].id,
      });
    }
  }

  async function saveRingConfig() {
    if (!configChild) return;
    setConfigSaving(true);

    try {
      const res = await fetch('/api/ring-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: configChild.id,
          rings: configRings.map((r) => ({
            slot: r.slot,
            ring_type: r.ring_type,
            module_id: r.ring_type === 'curriculum' ? r.module_id : null,
            subject: r.ring_type === 'curriculum' ? r.subject : null,
            custom_label: r.ring_type === 'custom_timed' ? r.custom_label : null,
            custom_icon: r.ring_type === 'custom_timed' ? r.custom_icon : null,
            color: r.color,
            daily_goal_minutes: r.daily_goal_minutes,
          })),
        }),
      });

      if (res.ok) {
        setConfigChild(null);
        loadChildren();
      }
    } catch (err) {
      console.error('Error saving ring config:', err);
    } finally {
      setConfigSaving(false);
    }
  }

  // ============================================
  // RENDER HELPERS
  // ============================================

  const familyCode = profile?.family_code;
  const totalKids = children.length;
  const totalTodayMinutes = children.reduce(
    (s, c) => s + c.progress.reduce((ps, p) => ps + p.total_minutes, 0), 0
  );
  const longestStreak = Math.max(0, ...children.map((c) => c.streak?.current_streak || 0));
  const totalAllPoints = children.reduce((s, c) => s + c.totalPoints, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono text-4xl font-bold mb-2">
          Welcome back, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-[var(--muted)]">{"Here's how your kids are doing today."}</p>
      </div>

      {/* Family Code Banner */}
      {familyCode && (
        <div className="rounded-xl p-4 flex items-center justify-between mb-8"
          style={{ background: 'linear-gradient(135deg, rgba(78,205,196,0.15), rgba(107,207,127,0.15))', border: '1px solid rgba(78,205,196,0.3)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="text-sm font-semibold">Family Code</p>
              <p className="text-xs text-[var(--muted)]">Kids use this + their PIN to log in</p>
            </div>
          </div>
          <div className="font-mono text-2xl font-bold tracking-[0.3em] text-[#4ECDC4]">{familyCode}</div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Children', value: totalKids, meta: 'Enrolled', icon: '👧' },
          { label: "Today's Activity", value: `${totalTodayMinutes}m`, meta: 'Total minutes', icon: '⏱️' },
          { label: 'Best Streak', value: longestStreak, meta: 'Consecutive days', icon: '🔥' },
          { label: 'Total Points', value: totalAllPoints.toLocaleString(), meta: 'All time', icon: '⭐' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="font-mono text-4xl font-bold gradient-text">{stat.value}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{stat.meta}</p>
          </div>
        ))}
      </div>

      {/* Activity Rings Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-xl font-bold">Activity Rings</h2>
          <button onClick={() => setShowAddChild(true)}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0f0f0f] hover:-translate-y-0.5 hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}>
            + Add Child
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--muted)]">Loading...</div>
        ) : children.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">👶</div>
            <h3 className="font-mono text-lg font-bold mb-2">No children yet</h3>
            <p className="text-[var(--muted)] text-sm mb-4">Add your first child to start tracking their learning progress.</p>
            <button onClick={() => setShowAddChild(true)}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0f0f0f]"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}>
              + Add Child
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => router.push(`/dashboard/child/${child.id}`)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-7 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all cursor-pointer group"
              >
                <div className="flex gap-6 items-center">
                  {/* Dynamic ring display */}
                  <ActivityRing size={120} strokeWidth={10} rings={
                    child.progress.map((p) => ({
                      progress: p.percentage,
                      color: p.ring_color,
                      label: p.ring_label,
                      icon: p.ring_icon,
                    }))
                  } />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-[#FF6B6B] transition-colors">
                          {child.avatar_emoji} {child.name}
                        </h3>
                        <p className="text-sm text-[var(--muted)]">Grade {child.grade} &middot; Age {child.age}</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          View full history →
                        </p>
                      </div>
                      {/* Configure Rings button — stops card click from firing */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openRingConfig(child); }}
                        className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Configure Rings"
                      >
                        ⚙️
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {child.progress.map((p) => (
                        <span key={p.ring_slot} className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          p.percentage >= 100
                            ? 'bg-[#6BCF7F]/20 text-[#6BCF7F]'
                            : p.percentage > 0
                              ? 'bg-[#FFD93D]/20 text-[#FFD93D]'
                              : 'bg-[var(--card-hover)] text-[var(--muted)]'
                        }`}>
                          {p.total_minutes}m / {p.goal_minutes}m {p.ring_label}
                        </span>
                      ))}
                      {child.streak && child.streak.current_streak > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FFD93D]/20 text-[#FFD93D]">
                          🔥 {child.streak.current_streak} day streak
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-mono text-xl font-bold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '📚', title: 'Browse Lessons', desc: 'Find interactive lessons for your kids', href: '/lessons' },
            { icon: '⚙️', title: 'Manage Goals', desc: 'Set daily activity goals for each child', href: '/lessons' },
            { icon: '📊', title: 'View Reports', desc: 'Weekly progress summaries', href: '/lessons' },
          ].map((a) => (
            <Link key={a.title} href={a.href} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all block">
              <span className="text-3xl mb-3 block">{a.icon}</span>
              <h3 className="font-semibold mb-1">{a.title}</h3>
              <p className="text-xs text-[var(--muted)]">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* ADD CHILD MODAL */}
      {/* ============================================ */}
      {showAddChild && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="font-mono text-2xl font-bold mb-2">Add a Child</h2>
            <p className="text-[var(--muted)] text-sm mb-6">Set up a profile for your kid</p>

            <form onSubmit={addChild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {kidEmojis.map((e) => (
                    <button key={e} type="button" onClick={() => setNewChildEmoji(e)}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                        newChildEmoji === e ? 'bg-[#FF6B6B]/20 border-2 border-[#FF6B6B] scale-110' : 'bg-[var(--card)] border border-[var(--border)]'
                      }`}>{e}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Name</label>
                <input type="text" value={newChildName} onChange={(e) => setNewChildName(e.target.value)}
                  placeholder="Child's name" required
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Age</label>
                  <select value={newChildAge} onChange={(e) => setNewChildAge(e.target.value)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-[#FF6B6B]">
                    {[3,4,5,6,7,8,9,10,11,12].map((a) => <option key={a} value={a}>{a} years</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Grade</label>
                  <select value={newChildGrade} onChange={(e) => setNewChildGrade(e.target.value)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-[#FF6B6B]">
                    {['Pre-K','K','1','2','3','4','5','6','7','8'].map((g) => (
                      <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : g === 'Pre-K' ? 'Pre-K' : `Grade ${g}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Kid&apos;s Login PIN (4 digits)
                </label>
                <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4}
                  value={newChildPin}
                  onChange={(e) => setNewChildPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 1234" required
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B] font-mono text-2xl tracking-[0.5em] text-center" />
                <p className="text-xs text-[var(--muted)] mt-1">Your child will use this PIN + your family code to log in</p>
              </div>

              {addError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{addError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddChild(false); setAddError(''); }}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm text-[#0f0f0f] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}>
                  {saving ? 'Adding...' : 'Add Child'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* RING CONFIG MODAL */}
      {/* ============================================ */}
      {configChild && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{configChild.avatar_emoji}</span>
              <div>
                <h2 className="font-mono text-2xl font-bold">Configure Rings</h2>
                <p className="text-[var(--muted)] text-sm">{configChild.name} &middot; Grade {configChild.grade}</p>
              </div>
            </div>

            <div className="space-y-6">
              {configRings.map((ring) => {
                const isFlexibleSlot = ring.slot === 3;
                // Show ALL modules for the chosen subject (no grade filter) so parents
                // can assign any available lesson, including ones like Vocabulary Builders.
                // Grade-appropriate modules are shown first, then the rest.
                const subjectModules = ring.ring_type === 'curriculum'
                  ? CURRICULUM_CATALOG.filter((m) => m.subject === ring.subject)
                  : [];
                const gradeModules = subjectModules; // alias kept for template compatibility

                return (
                  <div key={ring.slot} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                    {/* Ring header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: ring.color }} />
                        <h3 className="font-semibold">Ring {ring.slot}</h3>
                      </div>
                      {isFlexibleSlot && (
                        <div className="flex gap-1 bg-[var(--background)] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateRingConfig(3, { ring_type: 'curriculum', subject: 'math' })}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                              ring.ring_type === 'curriculum'
                                ? 'bg-[#4ECDC4]/20 text-[#4ECDC4]'
                                : 'text-[var(--muted)]'
                            }`}
                          >
                            Curriculum
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRingConfig(3, { ring_type: 'custom_timed' })}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                              ring.ring_type === 'custom_timed'
                                ? 'bg-[#6BCF7F]/20 text-[#6BCF7F]'
                                : 'text-[var(--muted)]'
                            }`}
                          >
                            Custom Activity
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Curriculum config */}
                    {ring.ring_type === 'curriculum' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Subject</label>
                          <select
                            value={ring.subject}
                            onChange={(e) => updateRingConfig(ring.slot, { subject: e.target.value, module_id: null })}
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:border-[#4ECDC4]"
                          >
                            <option value="math">Math</option>
                            <option value="reading">Reading</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Module</label>
                          <select
                            value={ring.module_id || ''}
                            onChange={(e) => updateRingConfig(ring.slot, { module_id: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:border-[#4ECDC4]"
                          >
                            <option value="">Select a module...</option>
                            {gradeModules.map((m) => {
                              const isGradeMatch = matchesGrade(m.grades, configChild.grade);
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.icon} {m.title} ({m.grades}){!isGradeMatch ? ' ↑ advanced' : ''}{m.lessonUrl ? ' ✓' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAutoAssign(ring.slot, ring.subject)}
                          className="w-full py-2 rounded-lg text-xs font-semibold bg-[#4ECDC4]/10 text-[#4ECDC4] hover:bg-[#4ECDC4]/20 transition-colors"
                        >
                          ✨ Auto-assign by grade
                        </button>
                      </div>
                    ) : (
                      /* Custom timed activity config */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Activity Name</label>
                          <input
                            type="text"
                            value={ring.custom_label}
                            onChange={(e) => updateRingConfig(ring.slot, { custom_label: e.target.value })}
                            placeholder="e.g. Typing Practice"
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] text-sm focus:outline-none focus:border-[#6BCF7F]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Icon</label>
                          <div className="flex gap-2 flex-wrap">
                            {['⏱️', '🎯', '⌨️', '🎨', '🎵', '🏃', '🧩', '✏️', '🔬', '🌍'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => updateRingConfig(ring.slot, { custom_icon: emoji })}
                                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                                  ring.custom_icon === emoji
                                    ? 'bg-[#6BCF7F]/20 border-2 border-[#6BCF7F] scale-110'
                                    : 'bg-[var(--background)] border border-[var(--border)]'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Daily goal slider */}
                    <div className="mt-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                        Daily Goal (minutes)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="10"
                          max="90"
                          step="5"
                          value={ring.daily_goal_minutes}
                          onChange={(e) => updateRingConfig(ring.slot, { daily_goal_minutes: parseInt(e.target.value) })}
                          className="flex-1 accent-[#FFD93D]"
                        />
                        <span className="font-mono text-sm font-bold w-12 text-right">{ring.daily_goal_minutes}m</span>
                      </div>
                    </div>

                    {/* Color picker */}
                    <div className="mt-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Ring Color</label>
                      <div className="flex gap-2">
                        {['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4', '#A78BFA', '#F472B6', '#FB923C'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateRingConfig(ring.slot, { color: c })}
                            className={`w-7 h-7 rounded-full transition-all ${
                              ring.color === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfigChild(null)}
                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRingConfig}
                disabled={configSaving}
                className="flex-1 py-3 rounded-lg font-semibold text-sm text-[#0f0f0f] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4ECDC4, #6BCF7F)' }}
              >
                {configSaving ? 'Saving...' : 'Save Rings'}
              </button>
            </div>

            {/* ============================================ */}
            {/* CURRICULUM ROADMAP */}
            {/* ============================================ */}
            <div className="mt-8 pt-6 border-t border-[var(--border)]">
              <div className="mb-4">
                <h3 className="font-mono text-lg font-bold">Full Curriculum Roadmap</h3>
                <p className="text-xs text-[var(--muted)]">
                  {CURRICULUM_CATALOG.length} modules across Math & Reading &middot; K through Grade 6
                </p>
              </div>

              {/* Math Modules */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📐</span>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#FF6B6B]">
                    Math ({CURRICULUM_CATALOG.filter((m) => m.subject === 'math').length} modules)
                  </h4>
                </div>
                <div className="space-y-2">
                  {CURRICULUM_CATALOG.filter((m) => m.subject === 'math').map((mod) => {
                    const isRecommended = matchesGrade(mod.grades, configChild.grade);
                    const isAssigned = configRings.some((r) => r.module_id === mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                          isAssigned
                            ? 'border-[#4ECDC4]/50 bg-[#4ECDC4]/5'
                            : isRecommended
                              ? 'border-[#FFD93D]/30 bg-[#FFD93D]/5'
                              : 'border-[var(--border)] bg-[var(--card)]'
                        }`}
                      >
                        <span className="text-xl">{mod.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{mod.title}</p>
                          <p className="text-xs text-[var(--muted)]">{mod.grades} &middot; {mod.duration} &middot; {mod.activities} activities</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {isAssigned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4ECDC4]/20 text-[#4ECDC4]">
                              Assigned
                            </span>
                          )}
                          {isRecommended && !isAssigned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFD93D]/20 text-[#FFD93D]">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reading Modules */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📖</span>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#4ECDC4]">
                    Reading ({CURRICULUM_CATALOG.filter((m) => m.subject === 'reading').length} modules)
                  </h4>
                </div>
                <div className="space-y-2">
                  {CURRICULUM_CATALOG.filter((m) => m.subject === 'reading').map((mod) => {
                    const isRecommended = matchesGrade(mod.grades, configChild.grade);
                    const isAssigned = configRings.some((r) => r.module_id === mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                          isAssigned
                            ? 'border-[#4ECDC4]/50 bg-[#4ECDC4]/5'
                            : isRecommended
                              ? 'border-[#FFD93D]/30 bg-[#FFD93D]/5'
                              : 'border-[var(--border)] bg-[var(--card)]'
                        }`}
                      >
                        <span className="text-xl">{mod.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{mod.title}</p>
                          <p className="text-xs text-[var(--muted)]">{mod.grades} &middot; {mod.duration} &middot; {mod.activities} activities</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {isAssigned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4ECDC4]/20 text-[#4ECDC4]">
                              Assigned
                            </span>
                          )}
                          {isRecommended && !isAssigned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFD93D]/20 text-[#FFD93D]">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
