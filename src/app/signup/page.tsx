'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const AVATAR_EMOJIS = ['👨‍👩‍👧', '👩‍👧', '👨‍👧', '👩‍👦', '👨‍👦', '🧑‍🏫', '👪', '🏠'];

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👨‍👩‍👧');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function generateFamilyCode(): string {
    // Generate a 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'parent',
          avatar_emoji: selectedEmoji,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Generate and save family code to the profile
    if (signUpData?.user) {
      const familyCode = generateFamilyCode();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ family_code: familyCode })
        .eq('id', signUpData.user.id);

      if (updateError) {
        console.error('Failed to set family code:', updateError);
        // Non-critical — they can still use the app, we'll retry later
      }
    }

    router.push('/dashboard');
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-mono text-4xl font-bold gradient-text mb-2">After School</h1>
          <p className="text-[var(--muted)] text-sm">Create your family account</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
          <h2 className="font-mono text-2xl font-bold mb-1">Get started</h2>
          <p className="text-[var(--muted)] text-sm mb-8">
            Set up your parent account to manage your kids&apos; learning
          </p>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Avatar picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                Choose Your Avatar
              </label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                      selectedEmoji === emoji
                        ? 'bg-[#FF6B6B]/20 border-2 border-[#FF6B6B] scale-110'
                        : 'bg-[var(--card)] border border-[var(--border)] hover:border-[var(--foreground)]/30'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B] transition-colors"
              />
            </div>

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
                placeholder="At least 6 characters"
                required
                minLength={6}
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[var(--muted)] text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[#FF6B6B] hover:underline font-semibold">
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
