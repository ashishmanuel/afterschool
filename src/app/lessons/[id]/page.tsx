'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import type { Lesson, LessonContent } from '@/types/database';

export default function LessonViewer() {
  const { id } = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createClient();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentProblem, setCurrentProblem] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answerChecked, setAnswerChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sections = ['Hook', 'Explore', 'Learn', 'Practice', 'Wrap-Up'];

  useEffect(() => {
    loadLesson();
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLesson() {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setLesson(data);
    }
    setLoading(false);
  }

  const content: LessonContent | null = lesson?.content_json ?? null;

  const celebrate = useCallback(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4'],
    });
  }, []);

  function checkAnswer() {
    if (!content) return;
    const problem = content.practice.problems[currentProblem];
    const isCorrect = selectedAnswer.toLowerCase().trim() === problem.solution.toLowerCase().trim().substring(0, 50);
    // Simplified check - in real app you'd parse the solution more carefully
    setAnswerChecked(true);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      celebrate();
    }
  }

  function nextProblem() {
    if (!content) return;
    if (currentProblem < content.practice.problems.length - 1) {
      setCurrentProblem((p) => p + 1);
      setSelectedAnswer('');
      setAnswerChecked(false);
      setShowHint(false);
    } else {
      setCurrentSection(4); // Wrap-up
    }
  }

  async function completeLesson() {
    setCompleted(true);
    celebrate();
    if (timerRef.current) clearInterval(timerRef.current);

    // Save progress if authenticated
    if (profile) {
      const { data: children } = await supabase
        .from('children')
        .select('id')
        .eq('parent_id', profile.id)
        .limit(1);

      if (children?.[0]) {
        await supabase.from('lesson_progress').upsert({
          child_id: children[0].id,
          lesson_id: id as string,
          completed_at: new Date().toISOString(),
          time_spent_seconds: elapsedSeconds,
          score: content ? Math.round((correctCount / content.practice.problems.length) * 100) : 0,
          problems_correct: correctCount,
          problems_total: content?.practice.problems.length || 0,
        }, { onConflict: 'child_id,lesson_id' });

        // Log activity
        await supabase.from('activity_logs').insert({
          child_id: children[0].id,
          activity_type: lesson?.subject || 'math',
          minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
          points_earned: correctCount * 10 + 5,
          lesson_id: id as string,
          logged_date: new Date().toISOString().split('T')[0],
        });
      }
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const progressPercent = ((currentSection + 1) / sections.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl flame-pulse">📚</div>
      </div>
    );
  }

  if (!lesson || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="font-mono text-2xl font-bold mb-2">Lesson not found</h2>
          <p className="text-[var(--muted)] mb-4">This lesson may not exist in the database yet.</p>
          <button
            onClick={() => router.push('/lessons')}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0f0f0f]"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
          >
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  // Completion screen
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-6">🎉</div>
          <h1 className="font-mono text-3xl font-bold gradient-text mb-4">
            Lesson Complete!
          </h1>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="font-mono text-2xl font-bold text-[#FF6B6B]">{formatTime(elapsedSeconds)}</p>
                <p className="text-xs text-[var(--muted)]">Time</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-[#6BCF7F]">
                  {correctCount}/{content.practice.problems.length}
                </p>
                <p className="text-xs text-[var(--muted)]">Correct</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-[#FFD93D]">
                  +{correctCount * 10 + 5}
                </p>
                <p className="text-xs text-[var(--muted)]">Points</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/kid')}
            className="px-8 py-3 rounded-lg font-semibold text-[#0f0f0f]"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar: progress + timer */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/90 backdrop-blur border-b border-[var(--border)]">
        {/* Progress bar */}
        <div className="h-1 bg-[var(--border)]">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #FF6B6B, #FFD93D, #6BCF7F)',
            }}
          />
        </div>
        <div className="flex items-center justify-between px-6 py-3">
          <button
            onClick={() => router.back()}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm"
          >
            ← Exit
          </button>
          <div className="flex items-center gap-4">
            {sections.map((s, i) => (
              <button
                key={s}
                onClick={() => setCurrentSection(i)}
                className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                  i === currentSection
                    ? 'text-[#FF6B6B]'
                    : i < currentSection
                    ? 'text-[#6BCF7F]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="font-mono text-sm text-[var(--muted)]">
            ⏱️ {formatTime(elapsedSeconds)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        {/* Section 0: Hook */}
        {currentSection === 0 && (
          <div className="space-y-8">
            <div className="text-center">
              <span className="text-6xl block mb-4">🎮</span>
              <h1 className="font-mono text-3xl font-bold mb-4">{lesson.title}</h1>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
              <p className="text-lg leading-relaxed mb-6">{content.hook.scenario}</p>
              <p className="text-[#FFD93D] font-semibold text-lg">
                💡 {content.hook.question}
              </p>
            </div>
            <div className="text-center">
              <button
                onClick={() => setCurrentSection(1)}
                className="px-8 py-3 rounded-lg font-semibold text-[#0f0f0f] text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
              >
                {"Let's Explore! →"}
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Explore */}
        {currentSection === 1 && (
          <div className="space-y-8">
            <h2 className="font-mono text-2xl font-bold">🔍 Explore</h2>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
              <p className="text-lg leading-relaxed mb-6">{content.explore.activity}</p>
              <div className="space-y-3">
                {content.explore.guideQuestions.map((q, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-7 h-7 rounded-full bg-[#4ECDC4]/20 text-[#4ECDC4] flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-[var(--muted)]">{q}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <button
                onClick={() => setCurrentSection(2)}
                className="px-8 py-3 rounded-lg font-semibold text-[#0f0f0f] text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
              >
                Ready to Learn! →
              </button>
            </div>
          </div>
        )}

        {/* Section 2: Teach */}
        {currentSection === 2 && (
          <div className="space-y-8">
            <h2 className="font-mono text-2xl font-bold">📝 Learn</h2>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
              <p className="text-lg leading-relaxed">{content.teach.explanation}</p>
            </div>

            {/* Examples */}
            <div className="space-y-4">
              <h3 className="font-mono text-lg font-bold">Examples</h3>
              {content.teach.examples.map((ex, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                  <p className="font-semibold mb-3">📌 {ex.problem}</p>
                  <p className="text-[var(--muted)] text-sm whitespace-pre-line">{ex.solution}</p>
                </div>
              ))}
            </div>

            {/* Vocabulary */}
            <div>
              <h3 className="font-mono text-lg font-bold mb-3">Vocabulary</h3>
              <div className="flex flex-wrap gap-2">
                {content.teach.vocabulary.map((v, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-sm bg-[#4ECDC4]/10 text-[#4ECDC4] border border-[#4ECDC4]/20">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Common Mistakes */}
            <div>
              <h3 className="font-mono text-lg font-bold mb-3">⚠️ Watch Out!</h3>
              <div className="space-y-2">
                {content.teach.commonMistakes.map((m, i) => (
                  <div key={i} className="bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 rounded-lg p-3 text-sm">
                    {m}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setCurrentSection(3)}
                className="px-8 py-3 rounded-lg font-semibold text-[#0f0f0f] text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
              >
                Time to Practice! →
              </button>
            </div>
          </div>
        )}

        {/* Section 3: Practice */}
        {currentSection === 3 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-2xl font-bold">✏️ Practice</h2>
              <span className="text-sm text-[var(--muted)]">
                Problem {currentProblem + 1} of {content.practice.problems.length}
              </span>
            </div>

            {(() => {
              const problem = content.practice.problems[currentProblem];
              return (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
                  {/* Difficulty badge */}
                  <span
                    className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold mb-4 ${
                      problem.difficulty === 'easy'
                        ? 'bg-[#6BCF7F]/20 text-[#6BCF7F]'
                        : problem.difficulty === 'medium'
                        ? 'bg-[#FFD93D]/20 text-[#FFD93D]'
                        : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                    }`}
                  >
                    {problem.difficulty}
                  </span>

                  <p className="text-xl font-semibold mb-6">{problem.problem}</p>

                  {/* Answer input */}
                  <input
                    type="text"
                    value={selectedAnswer}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    disabled={answerChecked}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg text-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#FF6B6B] mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && !answerChecked && checkAnswer()}
                  />

                  {/* Hint */}
                  {!answerChecked && (
                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="text-sm text-[#FFD93D] hover:underline mb-4 block"
                    >
                      {showHint ? 'Hide hint' : '💡 Need a hint?'}
                    </button>
                  )}
                  {showHint && !answerChecked && (
                    <div className="bg-[#FFD93D]/10 border border-[#FFD93D]/20 rounded-lg p-3 text-sm mb-4">
                      {problem.hint}
                    </div>
                  )}

                  {/* Answer feedback */}
                  {answerChecked && (
                    <div className="mb-4">
                      <div className="bg-[#6BCF7F]/10 border border-[#6BCF7F]/20 rounded-lg p-4">
                        <p className="font-semibold text-[#6BCF7F] mb-2">Solution:</p>
                        <p className="text-sm">{problem.solution}</p>
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3">
                    {!answerChecked ? (
                      <button
                        onClick={checkAnswer}
                        disabled={!selectedAnswer}
                        className="flex-1 py-3 rounded-lg font-semibold text-[#0f0f0f] disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
                      >
                        Check Answer
                      </button>
                    ) : (
                      <button
                        onClick={nextProblem}
                        className="flex-1 py-3 rounded-lg font-semibold text-[#0f0f0f]"
                        style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
                      >
                        {currentProblem < content.practice.problems.length - 1
                          ? 'Next Problem →'
                          : 'Finish Practice →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Progress dots */}
            <div className="flex justify-center gap-2">
              {content.practice.problems.map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === currentProblem
                      ? 'bg-[#FF6B6B] scale-125'
                      : i < currentProblem
                      ? 'bg-[#6BCF7F]'
                      : 'bg-[var(--border)]'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Wrap-up */}
        {currentSection === 4 && (
          <div className="space-y-8">
            <h2 className="font-mono text-2xl font-bold">🎯 Wrap-Up</h2>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
              <h3 className="font-semibold text-lg mb-3">What we learned:</h3>
              <p className="text-[var(--muted)] leading-relaxed mb-6">{content.wrapup.recap}</p>

              <h3 className="font-semibold text-lg mb-3">🌍 Real World:</h3>
              <p className="text-[var(--muted)] leading-relaxed mb-6">{content.wrapup.realWorld}</p>

              <h3 className="font-semibold text-lg mb-3">⏭️ Coming Next:</h3>
              <p className="text-[var(--muted)] leading-relaxed">{content.wrapup.nextLesson}</p>
            </div>

            <div className="text-center">
              <button
                onClick={completeLesson}
                className="px-10 py-4 rounded-xl font-bold text-[#0f0f0f] text-xl hover:-translate-y-1 hover:shadow-xl transition-all"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
              >
                🎉 Complete Lesson!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
