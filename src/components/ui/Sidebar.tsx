'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const parentNav = [
  { label: 'Dashboard', icon: '📊', href: '/dashboard' },
  { label: 'Children', icon: '👧', href: '/dashboard' },
  { label: 'Lessons', icon: '📚', href: '/lessons' },
  { label: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
];

const kidNav = [
  { label: 'My Dashboard', icon: '🏠', href: '/dashboard/kid' },
  { label: 'Lessons', icon: '📚', href: '/lessons' },
  { label: 'Achievements', icon: '🏆', href: '/dashboard/kid/achievements' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const { profile, signOut } = useAuth();
  const pathname = usePathname();

  const nav = profile?.role === 'kid' ? kidNav : parentNav;

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`fixed top-5 z-[101] w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)] transition-all text-lg ${
          collapsed ? 'left-5' : 'left-[300px]'
        }`}
      >
        {collapsed ? '☰' : '✕'}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 z-[101] w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)] transition-all text-lg"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[280px] border-r border-[var(--border)] flex flex-col z-[100] transition-transform duration-300 ${
          collapsed ? '-translate-x-[280px]' : 'translate-x-0'
        }`}
        style={{
          background: 'linear-gradient(180deg, var(--card-hover) 0%, var(--background) 100%)',
        }}
      >
        <div className="p-8">
          {/* Logo */}
          <h1 className="font-mono text-2xl font-bold gradient-text mb-12">
            After School
          </h1>

          {/* Nav */}
          <nav className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
              Menu
            </span>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  pathname === item.href
                    ? 'bg-[var(--card-hover)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* User card at bottom */}
        <div className="mt-auto p-6 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 p-3 bg-[var(--card)] rounded-lg">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)' }}
            >
              {profile?.avatar_emoji || '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {profile?.full_name || 'Loading...'}
              </p>
              <p className="text-xs text-[var(--muted)] capitalize">
                {profile?.role || 'parent'}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-3 w-full text-center text-xs text-[var(--muted)] hover:text-[#FF6B6B] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
