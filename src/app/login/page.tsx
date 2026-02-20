'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-mono text-4xl font-bold gradient-text mb-2">
            After School
          </h1>
          <p className="text-[var(--muted)] text-sm">
            Learning made fun. Every single day.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
          <h2 className="font-mono text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-[var(--muted)] text-sm mb-8">
            Sign in to continue your learning journey
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                required
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg font-semibold text-[#0f0f0f] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[var(--muted)] text-sm">
              {"Don't have an account? "}
              <Link href="/signup" className="text-[#FF6B6B] hover:underline font-semibold">
                Sign up
              </Link>
            </span>
          </div>
        </div>

        {/* Kid Login Link */}
        <div className="mt-6 text-center">
          <Link
            href="/kid-login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[#4ECDC4]/50 hover:bg-[#4ECDC4]/10 transition-all"
          >
            <span className="text-xl">🧒</span>
            <span className="text-sm font-semibold">I&apos;m a kid — Log in with my code</span>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-[var(--muted)] text-xs mt-6">
          Building great learners, one day at a time.
        </p>
      </div>
    </div>
  );
}
