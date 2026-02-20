'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { KidSession } from '@/types/database';

type Step = 'family-code' | 'pin';

export default function KidLoginPage() {
  const [step, setStep] = useState<Step>('family-code');
  const [familyCode, setFamilyCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeEmoji, setWelcomeEmoji] = useState('');
  const router = useRouter();

  const currentValue = step === 'family-code' ? familyCode : pin;
  const maxLength = step === 'family-code' ? 6 : 4;

  function handleDigit(digit: string) {
    if (step === 'family-code' && familyCode.length < 6) {
      const next = familyCode + digit;
      setFamilyCode(next);
      setError('');
    } else if (step === 'pin' && pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setError('');
    }
  }

  function handleDelete() {
    if (step === 'family-code') {
      setFamilyCode(familyCode.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
    setError('');
  }

  function handleClear() {
    if (step === 'family-code') {
      setFamilyCode('');
    } else {
      setPin('');
    }
    setError('');
  }

  async function handleNext() {
    if (step === 'family-code') {
      if (familyCode.length !== 6) {
        setError('Enter all 6 digits!');
        return;
      }
      setStep('pin');
      setError('');
      return;
    }

    // Step is 'pin' — attempt login
    if (pin.length !== 4) {
      setError('Enter all 4 digits!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/kid-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyCode, kidPin: pin }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Hmm, that didn\'t work. Try again!');
        setLoading(false);
        return;
      }

      // Show welcome animation briefly
      setWelcomeName(data.child_name);
      setWelcomeEmoji(data.avatar_emoji);

      // Save kid session to localStorage
      const session: KidSession = {
        child_id: data.child_id,
        child_name: data.child_name,
        avatar_emoji: data.avatar_emoji,
        parent_id: data.parent_id,
        logged_in_at: new Date().toISOString(),
      };
      localStorage.setItem('kid_session', JSON.stringify(session));

      // Wait a moment for the welcome screen, then redirect
      // Use window.location for a clean full-page load (kid has no Supabase auth)
      setTimeout(() => {
        window.location.href = '/dashboard/kid';
      }, 1500);
    } catch {
      setError('Oops! Something went wrong. Try again!');
      setLoading(false);
    }
  }

  // Welcome screen after successful login
  if (welcomeName) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
        <div className="text-center animate-bounce">
          <div className="text-8xl mb-6">{welcomeEmoji}</div>
          <h1 className="font-mono text-5xl font-bold gradient-text mb-4">
            Hi, {welcomeName}!
          </h1>
          <p className="text-2xl text-[var(--muted)]">Let&apos;s learn something awesome! 🚀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-mono text-4xl md:text-5xl font-bold gradient-text mb-2">
          After School
        </h1>
        <p className="text-[var(--muted)] text-lg">
          {step === 'family-code' ? '🏠 Enter your family code' : '🔑 Enter your PIN'}
        </p>
      </div>

      {/* Code Display */}
      <div className="flex gap-3 mb-6 justify-center">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div key={i} className={`
            w-12 h-16 md:w-14 md:h-18 rounded-xl border-2 flex items-center justify-center
            font-mono text-3xl md:text-4xl font-bold transition-all duration-200
            ${i < currentValue.length
              ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 text-[#FF6B6B] scale-105'
              : i === currentValue.length
                ? 'border-[#FFD93D]/50 bg-[var(--card)] text-[var(--foreground)] animate-pulse'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)]'
            }
          `}>
            {currentValue[i] || ''}
          </div>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        <div className={`h-2 w-12 rounded-full transition-colors ${step === 'family-code' ? 'bg-[#FF6B6B]' : 'bg-[#6BCF7F]'}`} />
        <div className={`h-2 w-12 rounded-full transition-colors ${step === 'pin' ? 'bg-[#FF6B6B]' : 'bg-[var(--border)]'}`} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-3 mb-4 text-red-400 text-center font-semibold">
          {error}
        </div>
      )}

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-xs w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleDigit(num.toString())}
            disabled={loading}
            className="h-16 md:h-18 rounded-2xl font-mono text-2xl md:text-3xl font-bold
              bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--card-hover)] hover:border-[#FF6B6B]/50 hover:scale-105
              active:scale-95 active:bg-[#FF6B6B]/20
              transition-all duration-150 disabled:opacity-50"
          >
            {num}
          </button>
        ))}

        {/* Bottom row: Clear, 0, Delete */}
        <button
          onClick={handleClear}
          disabled={loading}
          className="h-16 md:h-18 rounded-2xl text-sm font-semibold
            bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]
            hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400
            active:scale-95 transition-all duration-150 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          onClick={() => handleDigit('0')}
          disabled={loading}
          className="h-16 md:h-18 rounded-2xl font-mono text-2xl md:text-3xl font-bold
            bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]
            hover:bg-[var(--card-hover)] hover:border-[#FF6B6B]/50 hover:scale-105
            active:scale-95 active:bg-[#FF6B6B]/20
            transition-all duration-150 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="h-16 md:h-18 rounded-2xl text-2xl
            bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]
            hover:bg-[#FFD93D]/10 hover:border-[#FFD93D]/30 hover:text-[#FFD93D]
            active:scale-95 transition-all duration-150 disabled:opacity-50"
        >
          ⌫
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 max-w-xs w-full">
        {step === 'pin' && (
          <button
            onClick={() => { setStep('family-code'); setPin(''); setError(''); }}
            disabled={loading}
            className="flex-1 py-4 rounded-xl font-semibold text-sm
              bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--card-hover)] transition-all disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={loading || currentValue.length !== maxLength}
          className="flex-1 py-4 rounded-xl font-bold text-lg text-[#0f0f0f]
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:-translate-y-0.5 hover:shadow-lg active:scale-95
            transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Logging in...
            </span>
          ) : step === 'family-code' ? (
            'Next →'
          ) : (
            'Let\'s Go! 🚀'
          )}
        </button>
      </div>

      {/* Footer links */}
      <div className="mt-8 text-center">
        <p className="text-[var(--muted)] text-sm mb-2">
          Ask your parent for your family code and PIN!
        </p>
        <Link href="/login" className="text-[#4ECDC4] hover:underline text-sm font-semibold">
          I&apos;m a parent → Sign in here
        </Link>
      </div>
    </div>
  );
}
