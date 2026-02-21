'use client';

import { useAuth } from '@/contexts/AuthContext';

const comingSoonFeatures = [
  { icon: '🔔', title: 'Notification Preferences', desc: 'Daily reminders, progress alerts, weekly summaries' },
  { icon: '📊', title: 'Learning Analytics', desc: 'Detailed reports, export data, progress trends' },
  { icon: '💳', title: 'Subscription Management', desc: 'Plans, billing, family sharing options' },
  { icon: '🌍', title: 'Language & Region', desc: 'Multi-language support, time zones, date formats' },
  { icon: '🔒', title: 'Privacy & Safety', desc: 'Screen time limits, content filters, data controls' },
  { icon: '🎨', title: 'Appearance', desc: 'Custom themes, font sizes, accessibility options' },
];

export default function SettingsPage() {
  const { user, profile } = useAuth();

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono text-4xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--muted)]">Manage your account and preferences</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 mb-8">
        <h2 className="font-mono text-lg font-bold mb-6 flex items-center gap-2">
          👤 Account Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
              Name
            </label>
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm">
              {profile?.full_name || 'Loading...'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
              Email
            </label>
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm">
              {user?.email || 'Loading...'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
              Role
            </label>
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm capitalize">
              {profile?.role || 'parent'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
              Member Since
            </label>
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* Family Code Card */}
      {profile?.family_code && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 mb-8">
          <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
            👨‍👩‍👧‍👦 Family Code
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Share this code with your kids so they can log in to their learning dashboard.
          </p>
          <div
            className="inline-flex items-center gap-3 px-6 py-4 rounded-xl text-2xl font-mono font-bold tracking-[0.3em]"
            style={{
              background: 'linear-gradient(135deg, rgba(78,205,196,0.1), rgba(255,107,107,0.1))',
              border: '2px solid var(--border)',
            }}
          >
            {profile.family_code}
          </div>
        </div>
      )}

      {/* Coming Soon Section */}
      <div className="mb-4">
        <h2 className="font-mono text-lg font-bold mb-2 flex items-center gap-2">
          🚀 Coming Soon
        </h2>
        <p className="text-sm text-[var(--muted)] mb-6">
          We&apos;re building powerful tools to give you more control over your family&apos;s learning experience.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {comingSoonFeatures.map((feature) => (
          <div
            key={feature.title}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 opacity-70 relative overflow-hidden"
          >
            <div
              className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,217,61,0.15)',
                color: '#FFD93D',
                border: '1px solid rgba(255,217,61,0.3)',
              }}
            >
              Soon
            </div>
            <span className="text-3xl mb-3 block">{feature.icon}</span>
            <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
            <p className="text-xs text-[var(--muted)]">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
