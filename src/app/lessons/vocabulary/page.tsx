'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = 'level-select' | 'loading' | 'word-discover' | 'spelling' | 'sentence' | 'word-complete' | 'complete';
type Level = 'easy' | 'medium' | 'hard';

interface WordData {
  word: string;
  definition: string;
  sentence: string;
  blankSentence: string;
  emoji: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  easy:   { label: 'Easy',   emoji: '🌟', grades: 'Grade 1–2', bg: 'from-green-400 to-teal-400',   btnBg: 'bg-green-500 hover:bg-green-600',  textColor: 'text-green-700' },
  medium: { label: 'Medium', emoji: '⚡', grades: 'Grade 3–4', bg: 'from-amber-400 to-orange-400', btnBg: 'bg-amber-500 hover:bg-amber-600',  textColor: 'text-amber-700' },
  hard:   { label: 'Hard',   emoji: '🔥', grades: 'Grade 5–6', bg: 'from-rose-500 to-purple-600',  btnBg: 'bg-rose-500 hover:bg-rose-600',    textColor: 'text-rose-700'  },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBlankPattern(word: string): string[] {
  if (word.length <= 4) {
    return word.split('').map((l, i) => (i === 0 || i === word.length - 1 ? l : '_'));
  }
  return word.split('').map((l, i) => (i === 0 || i === word.length - 1 ? l : '_'));
}

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function playTone(hz: number, duration = 0.25) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = hz > 400 ? 'sine' : 'sawtooth';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext not available
  }
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.toLowerCase());
  u.rate = 0.82;
  u.pitch = 1.1;
  // Prefer a natural English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
  );
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VocabularyLesson() {
  const router = useRouter();
  const supabase = createClient();

  // Parent preview mode: parent logged in (Supabase auth) but no kid session.
  // Skip all DB writes — no progress saved, no activity logged.
  const isParentPreview =
    typeof window !== 'undefined'
      ? !localStorage.getItem('kid_session')
      : true; // SSR: default to safe (no writes)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('level-select');
  const [level, setLevel] = useState<Level>('easy');
  const [words, setWords] = useState<WordData[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [stars, setStars] = useState<boolean[]>(Array(10).fill(false));
  const [score, setScore] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Spelling state
  const [shuffledAlphabet] = useState(() => shuffleArray(ALPHABET));
  const [spellingLetters, setSpellingLetters] = useState<string[]>([]);
  const [spellingError, setSpellingError] = useState(false);
  const [spellingSuccess, setSpellingSuccess] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // Sentence / drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dropSuccess, setDropSuccess] = useState(false);
  const [dropError, setDropError] = useState(false);
  const [wordPlaced, setWordPlaced] = useState(false);

  // Timer for score saving
  const startTimeRef = useRef<number>(Date.now());

  const currentWord = words[wordIndex];
  const levelCfg = LEVEL_CONFIG[level];

  // ─── Load confetti lazily ───────────────────────────────────────────────────

  const fireConfetti = useCallback(async (big = false) => {
    const confetti = (await import('canvas-confetti')).default;
    if (big) {
      [0, 300, 600].forEach((delay) =>
        setTimeout(
          () =>
            confetti({
              particleCount: 160,
              spread: 120,
              origin: { y: 0.5 },
              colors: ['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4', '#a78bfa'],
            }),
          delay
        )
      );
    } else {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4'],
      });
    }
  }, []);

  // ─── Fetch words ────────────────────────────────────────────────────────────

  const fetchWords = useCallback(async (lvl: Level) => {
    setPhase('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/vocabulary?level=${lvl}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (!data.words || data.words.length < 5) throw new Error('Too few words');
      setWords(data.words);
      setWordIndex(0);
      setStars(Array(10).fill(false));
      setScore(0);
      startTimeRef.current = Date.now();
      setPhase('word-discover');
    } catch {
      setLoadError('Oops! Having trouble loading words. Please try again.');
      setPhase('level-select');
    }
  }, []);

  // ─── Start level ────────────────────────────────────────────────────────────

  const startLevel = useCallback(
    (lvl: Level) => {
      setLevel(lvl);
      setHintUsed(false);
      setHintVisible(false);
      setSpellingLetters([]);
      setSpellingError(false);
      setSpellingSuccess(false);
      setDropSuccess(false);
      setDropError(false);
      setWordPlaced(false);
      setSkipped(false);
      fetchWords(lvl);
    },
    [fetchWords]
  );

  // ─── Auto-speak on word discover ────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'word-discover' && currentWord) {
      const timer = setTimeout(() => speak(currentWord.word), 600);
      return () => clearTimeout(timer);
    }
  }, [phase, wordIndex, currentWord]);

  // ─── Keyboard input for spelling ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'spelling') return;
    const pattern = currentWord ? getBlankPattern(currentWord.word) : [];
    const blanks = pattern.filter((c) => c === '_').length;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        setSpellingLetters((prev) => prev.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        setSpellingLetters((prev) => {
          if (prev.length >= blanks) return prev;
          return [...prev, e.key.toUpperCase()];
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, currentWord]);

  // ─── Auto-check spelling when all blanks filled ─────────────────────────────

  useEffect(() => {
    if (phase !== 'spelling' || !currentWord) return;
    const pattern = getBlankPattern(currentWord.word);
    const blanks = pattern.filter((c) => c === '_').length;
    if (spellingLetters.length === blanks) {
      checkSpelling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spellingLetters]);

  // ─── Spelling check ─────────────────────────────────────────────────────────

  const checkSpelling = useCallback(() => {
    if (!currentWord) return;
    const pattern = getBlankPattern(currentWord.word);
    let li = 0;
    const fullAttempt = pattern.map((c) => (c === '_' ? (spellingLetters[li++] ?? '') : c)).join('');

    if (fullAttempt === currentWord.word) {
      playTone(880);
      setSpellingSuccess(true);
      setTimeout(() => {
        setSpellingSuccess(false);
        setSpellingLetters([]);
        setPhase('sentence');
      }, 900);
    } else {
      playTone(180);
      setSpellingError(true);
      setTimeout(() => {
        setSpellingError(false);
        setSpellingLetters([]);
      }, 700);
    }
  }, [currentWord, spellingLetters]);

  const addLetter = useCallback(
    (letter: string) => {
      if (!currentWord || phase !== 'spelling') return;
      const pattern = getBlankPattern(currentWord.word);
      const blanks = pattern.filter((c) => c === '_').length;
      setSpellingLetters((prev) => {
        if (prev.length >= blanks) return prev;
        return [...prev, letter];
      });
    },
    [currentWord, phase]
  );

  const removeLetter = useCallback(() => {
    setSpellingLetters((prev) => prev.slice(0, -1));
  }, []);

  const skipSpelling = useCallback(() => {
    setSkipped(true);
    setSpellingLetters([]);
    setPhase('sentence');
  }, []);

  // ─── Sentence drag ──────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dragged = e.dataTransfer.getData('text/plain');
      if (dragged === currentWord?.word) {
        playTone(660);
        setDropSuccess(true);
        setWordPlaced(true);
        const pts = skipped ? 5 : hintUsed ? 10 : 15;
        setScore((s) => s + pts);
        setStars((prev) => {
          const next = [...prev];
          next[wordIndex] = true;
          return next;
        });
        fireConfetti(false);
      } else {
        playTone(180);
        setDropError(true);
        setTimeout(() => setDropError(false), 700);
      }
    },
    [currentWord, hintUsed, skipped, wordIndex, fireConfetti]
  );

  // Touch drag fallback
  const touchDragRef = useRef<string>('');
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el?.classList.contains('drop-zone')) {
        const fakeEvent = { preventDefault: () => {}, dataTransfer: { getData: () => touchDragRef.current } } as unknown as React.DragEvent;
        handleDrop(fakeEvent);
      }
    },
    [handleDrop]
  );

  // ─── Next word ──────────────────────────────────────────────────────────────

  const nextWord = useCallback(() => {
    const next = wordIndex + 1;
    if (next >= words.length) {
      setPhase('complete');
      setTimeout(() => fireConfetti(true), 300);
      saveProgress();
    } else {
      setWordIndex(next);
      setHintUsed(false);
      setHintVisible(false);
      setSpellingLetters([]);
      setSpellingError(false);
      setSpellingSuccess(false);
      setDropSuccess(false);
      setDropError(false);
      setWordPlaced(false);
      setSkipped(false);
      setPhase('word-discover');
    }
  }, [wordIndex, words.length, fireConfetti]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save progress to Supabase ──────────────────────────────────────────────

  const saveProgress = useCallback(async () => {
    // Parent preview — never write data, never call supabase.auth.getUser()
    // (that call can trigger an auth refresh which breaks the layout)
    if (isParentPreview) return;

    try {
      // Kid session only — get childId from localStorage
      const kidSession = localStorage.getItem('kid_session');
      if (!kidSession) return;
      const childId = JSON.parse(kidSession).child_id;
      if (!childId) return;

      const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
      await supabase.from('activity_logs').insert({
        child_id: childId,
        activity_type: 'vocabulary',
        minutes: elapsedMinutes,
        points_earned: score,
        logged_date: new Date().toISOString().split('T')[0],
      });
    } catch {
      // Silently fail — don't break UX
    }
  }, [isParentPreview, supabase, score]);

  // ─── Score badge ────────────────────────────────────────────────────────────

  const getScoreBadge = () => {
    if (score >= 120) return { label: 'Vocabulary Champion', emoji: '🏆' };
    if (score >= 80)  return { label: 'Word Explorer',       emoji: '🌟' };
    return                   { label: 'Keep Learning',        emoji: '📚' };
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const StarBar = () => (
    <div className="flex gap-1 justify-center flex-wrap">
      {stars.map((lit, i) => (
        <span
          key={i}
          className={`text-2xl transition-all duration-300 ${lit ? 'scale-125' : 'opacity-40'}`}
        >
          {lit ? '🌟' : '⭐'}
        </span>
      ))}
    </div>
  );

  const SpellingDisplay = () => {
    if (!currentWord) return null;
    const pattern = getBlankPattern(currentWord.word);
    let li = 0;
    return (
      <div className="flex gap-2 justify-center flex-wrap my-4">
        {pattern.map((char, i) => {
          const isBlank = char === '_';
          const filled = isBlank ? (spellingLetters[li++] ?? null) : char;
          return (
            <div
              key={i}
              className={`w-10 h-12 border-b-4 flex items-end justify-center pb-1 transition-all
                ${isBlank
                  ? filled
                    ? 'border-purple-400'
                    : 'border-gray-300'
                  : 'border-transparent'
                }`}
            >
              <span className="text-2xl font-bold font-mono text-gray-800">
                {filled ?? (isBlank ? '' : char)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Phase renders ──────────────────────────────────────────────────────────

  // LEVEL SELECT
  if (phase === 'level-select') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
          .fredoka { font-family: 'Fredoka One', cursive; }`}
        </style>

        {isParentPreview && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#FFD93D]/90 text-[#0f0f0f] text-xs font-bold px-4 py-2 rounded-full shadow-lg">
            👀 Parent Preview — progress won&apos;t be saved
          </div>
        )}

        <div className="text-center mb-10">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="fredoka text-5xl text-white mb-2 drop-shadow-lg">Word Adventure!</h1>
          <p className="text-white/80 text-lg">Choose your challenge level to begin</p>
          {loadError && (
            <div className="mt-4 bg-red-100 text-red-700 rounded-2xl px-6 py-3 text-sm font-semibold">
              {loadError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
          {(['easy', 'medium', 'hard'] as Level[]).map((lvl) => {
            const cfg = LEVEL_CONFIG[lvl];
            return (
              <button
                key={lvl}
                onClick={() => startLevel(lvl)}
                className={`bg-gradient-to-br ${cfg.bg} rounded-3xl p-8 text-white text-center shadow-xl
                  hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-4 border-white/20`}
              >
                <div className="text-5xl mb-3">{cfg.emoji}</div>
                <div className="fredoka text-3xl mb-1">{cfg.label}</div>
                <div className="text-white/80 text-sm font-medium">{cfg.grades}</div>
                <div className="mt-4 bg-white/20 rounded-xl py-2 text-sm font-bold">
                  10 Random Words
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-white/60 text-sm mt-8">New words every time you play!</p>
      </div>
    );
  }

  // LOADING
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
          .fredoka { font-family: 'Fredoka One', cursive; }`}
        </style>
        <div className="text-7xl animate-bounce">📚</div>
        <p className="fredoka text-3xl text-white">Loading your words...</p>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-4 h-4 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // COMPLETE
  if (phase === 'complete') {
    const badge = getScoreBadge();
    const nextLvl: Record<Level, Level | null> = { easy: 'medium', medium: 'hard', hard: null };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
          .fredoka { font-family: 'Fredoka One', cursive; }`}
        </style>
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="text-7xl mb-4 animate-bounce">{badge.emoji}</div>
          <h2 className="fredoka text-4xl text-purple-700 mb-1">{badge.label}!</h2>
          <p className="text-gray-500 mb-6">You finished all 10 words!</p>

          <div className="bg-purple-50 rounded-2xl p-4 mb-6">
            <p className="text-5xl font-bold text-purple-600 fredoka">{score}</p>
            <p className="text-gray-500 text-sm">points earned</p>
          </div>

          <div className="flex gap-1 justify-center mb-8">
            {stars.map((lit, i) => (
              <span key={i} className={`text-xl transition-all ${lit ? 'scale-110' : 'opacity-30'}`}>
                {lit ? '🌟' : '⭐'}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => startLevel(level)}
              className="w-full py-4 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-lg transition-all"
            >
              🔄 Play Again
            </button>
            {nextLvl[level] && (
              <button
                onClick={() => startLevel(nextLvl[level]!)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg transition-all hover:scale-105"
              >
                ⚡ Try {LEVEL_CONFIG[nextLvl[level]!].label} Level
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/kid')}
              className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold transition-all"
            >
              🏠 Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  // ─── Main game layout (word-discover / spelling / sentence / word-complete) ──

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
        .fredoka { font-family: 'Fredoka One', cursive; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .shake { animation: shake 0.5s ease-in-out; }
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .pop { animation: pop 0.3s ease-out; }
        .drop-zone { min-height: 2rem; }
      `}</style>

      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setPhase('level-select')}
            className="text-white/70 hover:text-white text-sm font-medium transition-colors flex items-center gap-1"
          >
            ← Levels
          </button>
          <div className="fredoka text-white text-lg">
            {levelCfg.emoji} {levelCfg.label} · Word {wordIndex + 1}/10
          </div>
          <div className="fredoka text-white text-lg">⭐ {score} pts</div>
        </div>
        <StarBar />
      </div>

      {/* Main Card */}
      <div className="max-w-2xl mx-auto">
        {/* ── WORD DISCOVER ── */}
        {phase === 'word-discover' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="text-7xl mb-4 animate-bounce">{currentWord.emoji}</div>
            <h2
              className="fredoka text-5xl md:text-6xl mb-2"
              style={{ color: '#6d28d9' }}
            >
              {currentWord.word}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {currentWord.word.length} letters · {levelCfg.label} level
            </p>

            <div className="flex gap-3 justify-center mb-6 flex-wrap">
              <button
                onClick={() => speak(currentWord.word)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-sm transition-all hover:scale-105"
              >
                🔊 Hear it again
              </button>
              <button
                onClick={() => {
                  setHintUsed(true);
                  setHintVisible(true);
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105
                  ${hintVisible
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-amber-400 hover:bg-amber-500 text-white'}`}
              >
                💡 {hintVisible ? 'Hint shown' : 'Show Hint'}
              </button>
            </div>

            {hintVisible && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 text-left">
                <p className="text-amber-800 font-semibold text-sm mb-1">💡 What it means:</p>
                <p className="text-gray-700">{currentWord.definition}</p>
              </div>
            )}

            <button
              onClick={() => setPhase('spelling')}
              className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl transition-all hover:scale-105 active:scale-95 fredoka"
            >
              I&apos;m Ready to Spell! →
            </button>
          </div>
        )}

        {/* ── SPELLING ── */}
        {phase === 'spelling' && (
          <div
            className={`bg-white rounded-3xl shadow-2xl p-8 text-center
              ${spellingError ? 'shake' : ''}
              ${spellingSuccess ? 'ring-4 ring-green-400' : ''}`}
          >
            <p className="fredoka text-2xl text-purple-600 mb-1">Spell it out!</p>
            <p className="text-gray-400 text-sm mb-2">
              Fill in the missing letters for: <strong className="text-purple-700">{currentWord.word}</strong>
            </p>

            <SpellingDisplay />

            {spellingSuccess && (
              <div className="my-4 text-green-600 font-bold text-xl pop">✅ Correct!</div>
            )}
            {spellingError && (
              <div className="my-4 text-red-500 font-bold text-lg">❌ Not quite — try again!</div>
            )}

            {/* Letter grid */}
            <div className="grid grid-cols-9 gap-1.5 my-4 max-w-sm mx-auto">
              {shuffledAlphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => addLetter(letter)}
                  className="w-9 h-9 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-sm
                    transition-all hover:scale-110 active:scale-90 select-none"
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={removeLetter}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all"
              >
                ⌫ Backspace
              </button>
              <button
                onClick={skipSpelling}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-sm transition-all"
              >
                Skip (−5 pts)
              </button>
            </div>
          </div>
        )}

        {/* ── SENTENCE CHALLENGE ── */}
        {phase === 'sentence' && (
          <div className={`bg-white rounded-3xl shadow-2xl p-8 ${dropError ? 'shake' : ''}`}>
            <p className="fredoka text-2xl text-purple-600 text-center mb-2">Sentence Challenge!</p>
            <p className="text-gray-400 text-sm text-center mb-6">
              Drag the word into the right spot in the sentence
            </p>

            {/* Word chip to drag */}
            <div className="flex justify-center mb-6">
              {!wordPlaced ? (
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', currentWord.word);
                    setIsDragging(true);
                    touchDragRef.current = currentWord.word;
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onTouchStart={() => { touchDragRef.current = currentWord.word; }}
                  onTouchEnd={handleTouchEnd}
                  className={`px-6 py-3 rounded-2xl font-bold text-lg cursor-grab active:cursor-grabbing
                    select-none transition-all hover:scale-105 shadow-lg
                    ${isDragging ? 'opacity-60 scale-95' : 'opacity-100'}
                    bg-purple-500 text-white fredoka`}
                >
                  {currentWord.word}
                </div>
              ) : (
                <div className="px-6 py-3 rounded-2xl bg-green-100 text-green-600 font-bold text-lg fredoka">
                  ✅ {currentWord.word}
                </div>
              )}
            </div>

            {/* Sentence with drop zone */}
            <div
              className={`bg-gray-50 rounded-2xl p-5 text-lg leading-relaxed text-gray-700 border-2 transition-all
                ${isDragging ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={handleDrop}
            >
              {currentWord.blankSentence.split('________').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span
                      className={`drop-zone inline-block min-w-[120px] border-b-4 mx-1 text-center font-bold transition-all
                        ${wordPlaced
                          ? 'border-green-400 text-green-600'
                          : isDragging
                          ? 'border-purple-400 bg-purple-100 rounded-lg px-2'
                          : 'border-gray-400'}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      {wordPlaced ? currentWord.word : '________'}
                    </span>
                  )}
                </span>
              ))}
            </div>

            {dropSuccess && (
              <div className="text-center mt-4 text-green-600 font-bold text-xl pop">
                🎉 Amazing! You got it!
              </div>
            )}
            {dropError && (
              <div className="text-center mt-4 text-red-500 font-bold text-lg">
                ❌ Hmm, try dragging the word to the blank!
              </div>
            )}

            {wordPlaced && (
              <button
                onClick={nextWord}
                className="mt-6 w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl
                  transition-all hover:scale-105 active:scale-95 fredoka"
              >
                {wordIndex + 1 >= words.length ? '🏁 See Results!' : 'Next Word →'}
              </button>
            )}

            {/* Hint reminder */}
            {!wordPlaced && (
              <p className="text-center text-gray-400 text-xs mt-4">
                💡 {currentWord.definition}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Progress footer */}
      <div className="max-w-2xl mx-auto mt-6 text-center">
        <div className="w-full bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: `${(stars.filter(Boolean).length / 10) * 100}%` }}
          />
        </div>
        <p className="text-white/60 text-xs mt-2">
          {stars.filter(Boolean).length}/10 words mastered
        </p>
      </div>
    </div>
  );
}
