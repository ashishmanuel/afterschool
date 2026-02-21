'use client';

import { useEffect, useState } from 'react';
import type { KidSession } from '@/types/database';

interface KidStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  lessons_completed: number;
}

const achievementBadges = [
  { icon: '⭐', name: 'First Star', desc: 'Complete your first lesson', unlockAt: 1, type: 'lessons' },
  { icon: '🔥', name: 'On Fire!', desc: 'Reach a 3-day streak', unlockAt: 3, type: 'streak' },
  { icon: '📐', name: 'Math Whiz', desc: 'Earn 100 math points', unlockAt: 100, type: 'points' },
  { icon: '📖', name: 'Bookworm', desc: 'Complete 5 reading lessons', unlockAt: 5, type: 'lessons' },
  { icon: '🏆', name: 'Champion', desc: 'Reach a 7-day streak', unlockAt: 7, type: 'streak' },
  { icon: '💎', name: 'Diamond Mind', desc: 'Earn 500 total points', unlockAt: 500, type: 'points' },
  { icon: '🚀', name: 'Rocket Scholar', desc: 'Complete 10 lessons', unlockAt: 10, type: 'lessons' },
  { icon: '🌟', name: 'Superstar', desc: 'Reach a 14-day streak', unlockAt: 14, type: 'streak' },
  { icon: '🎯', name: 'Sharpshooter', desc: 'Score 100% on a quiz', unlockAt: 1, type: 'perfect' },
  { icon: '🧠', name: 'Big Brain', desc: 'Earn 1,000 total points', unlockAt: 1000, type: 'points' },
  { icon: '👑', name: 'Knowledge King', desc: 'Complete 25 lessons', unlockAt: 25, type: 'lessons' },
  { icon: '🌈', name: 'Rainbow Learner', desc: 'Reach a 30-day streak', unlockAt: 30, type: 'streak' },
];

export default function AchievementsPage() {
  const [kidSession, setKidSession] = useState<KidSession | null>(null);
  const [stats, setStats] = useState<KidStats>({
    total_points: 0,
    current_streak: 0,
    longest_streak: 0,
    lessons_completed: 0,
  });

  useEffect(() => {
    // Get kid session from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kid_session');
      if (stored) {
        const session: KidSession = JSON.parse(stored);
        setKidSession(session);
        loadStats(session.child_id);
      }
    }
  }, []);

  async function loadStats(childId: string) {
    try {
      const res = await fetch(`/api/children?parent_id=stats&child_id=${childId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setStats({
            total_points: data.total_points || 0,
            current_streak: data.current_streak || 0,
            longest_streak: data.longest_streak || 0,
            lessons_completed: data.lessons_completed || 0,
          });
        }
      }
    } catch {
      // Stats will stay at defaults
    }
  }

  function isUnlocked(badge: (typeof achievementBadges)[0]): boolean {
    switch (badge.type) {
      case 'streak':
        return stats.longest_streak >= badge.unlockAt;
      case 'points':
        return stats.total_points >= badge.unlockAt;
      case 'lessons':
        return stats.lessons_completed >= badge.unlockAt;
      default:
        return false;
    }
  }

  const unlockedCount = achievementBadges.filter(isUnlocked).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono text-4xl font-bold mb-2">
          {kidSession?.avatar_emoji || '🏆'} My Achievements
        </h1>
        <p className="text-[var(--muted)]">
          Collect badges by learning, practicing, and keeping your streak alive!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,107,0.15), rgba(255,107,107,0.05))',
            border: '1px solid rgba(255,107,107,0.2)',
          }}
        >
          <div className="text-3xl font-bold font-mono" style={{ color: '#FF6B6B' }}>
            {stats.total_points}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">Total Points</div>
        </div>
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,217,61,0.15), rgba(255,217,61,0.05))',
            border: '1px solid rgba(255,217,61,0.2)',
          }}
        >
          <div className="text-3xl font-bold font-mono" style={{ color: '#FFD93D' }}>
            {stats.current_streak}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">Day Streak</div>
        </div>
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(107,207,127,0.15), rgba(107,207,127,0.05))',
            border: '1px solid rgba(107,207,127,0.2)',
          }}
        >
          <div className="text-3xl font-bold font-mono" style={{ color: '#6BCF7F' }}>
            {stats.longest_streak}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">Best Streak</div>
        </div>
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(78,205,196,0.15), rgba(78,205,196,0.05))',
            border: '1px solid rgba(78,205,196,0.2)',
          }}
        >
          <div className="text-3xl font-bold font-mono" style={{ color: '#4ECDC4' }}>
            {stats.lessons_completed}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">Lessons Done</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-lg font-bold">Badge Collection</h2>
          <span className="text-sm text-[var(--muted)]">
            {unlockedCount} / {achievementBadges.length} unlocked
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--card-hover)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(unlockedCount / achievementBadges.length) * 100}%`,
              background: 'linear-gradient(90deg, #FF6B6B, #FFD93D, #6BCF7F, #4ECDC4)',
            }}
          />
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {achievementBadges.map((badge) => {
          const unlocked = isUnlocked(badge);
          return (
            <div
              key={badge.name}
              className={`rounded-2xl p-6 text-center transition-all ${
                unlocked
                  ? 'bg-[var(--card)] border-2 hover:scale-105'
                  : 'bg-[var(--card)] border border-[var(--border)] opacity-50'
              }`}
              style={
                unlocked
                  ? {
                      borderColor: '#FFD93D',
                      boxShadow: '0 0 20px rgba(255,217,61,0.1)',
                    }
                  : {}
              }
            >
              <div
                className={`text-5xl mb-3 ${unlocked ? '' : 'grayscale'}`}
                style={{ filter: unlocked ? 'none' : 'grayscale(100%) opacity(0.4)' }}
              >
                {unlocked ? badge.icon : '🔒'}
              </div>
              <h3 className="text-sm font-bold mb-1">{badge.name}</h3>
              <p className="text-xs text-[var(--muted)]">{badge.desc}</p>
              {unlocked && (
                <div
                  className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(107,207,127,0.15)',
                    color: '#6BCF7F',
                    border: '1px solid rgba(107,207,127,0.3)',
                  }}
                >
                  Unlocked!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
