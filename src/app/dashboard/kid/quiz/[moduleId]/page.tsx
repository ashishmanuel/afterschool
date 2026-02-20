'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { KidSession, PlacementQuizQuestion } from '@/types/database';

export default function PlacementQuizPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;

  const [questions, setQuestions] = useState<PlacementQuizQuestion[]>([]);
  const [moduleTitle, setModuleTitle] = useState('');
  const [passingScore, setPassingScore] = useState(4);
  const [comingSoon, setComingSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    passed: boolean;
    score: number;
    passingScore: number;
    nextModuleTitle: string | null;
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    // Get child ID from localStorage
    const kidSessionStr = localStorage.getItem('kid_session');
    if (kidSessionStr) {
      try {
        const session: KidSession = JSON.parse(kidSessionStr);
        setChildId(session.child_id);
      } catch {
        // Invalid session
      }
    }

    // Fetch quiz questions
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  async function fetchQuiz() {
    try {
      const res = await fetch(`/api/quiz?moduleId=${moduleId}`);
      const data = await res.json();

      setModuleTitle(data.moduleTitle || 'Quiz');
      setPassingScore(data.passingScore || 4);

      if (data.comingSoon || !data.questions || data.questions.length === 0) {
        setComingSoon(true);
      } else {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setComingSoon(true);
    }
    setLoading(false);
  }

  function selectAnswer(answer: string) {
    setSelectedAnswer(answer);
    setShowExplanation(false);
  }

  function confirmAnswer() {
    if (!selectedAnswer) return;
    setShowExplanation(true);
  }

  function nextQuestion() {
    if (!selectedAnswer) return;

    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);
    setSelectedAnswer(null);
    setShowExplanation(false);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete — submit results
      submitQuiz(newAnswers);
    }
  }

  async function submitQuiz(finalAnswers: string[]) {
    setSubmitting(true);

    // Calculate score
    const score = finalAnswers.reduce((total, answer, index) => {
      return total + (answer === questions[index].correctAnswer ? 1 : 0);
    }, 0);

    if (!childId) {
      // No child session — show result locally
      setQuizResult({
        passed: score >= passingScore,
        score,
        passingScore,
        nextModuleTitle: null,
        message: score >= passingScore
          ? 'Great job! You passed!'
          : "Let's keep learning — you'll get it next time!",
      });
      setShowResult(true);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          moduleId: parseInt(moduleId),
          score,
        }),
      });

      const data = await res.json();
      setQuizResult(data);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setQuizResult({
        passed: score >= passingScore,
        score,
        passingScore,
        nextModuleTitle: null,
        message: 'Something went wrong, but your score was recorded.',
      });
    }

    setShowResult(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-[var(--muted)]">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Coming Soon state
  if (comingSoon) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-6xl mb-6">🚧</div>
        <h1 className="font-mono text-3xl font-bold mb-3">Quiz Coming Soon</h1>
        <p className="text-[var(--muted)] mb-2">
          The placement quiz for <strong>{moduleTitle}</strong> is still being prepared.
        </p>
        <p className="text-[var(--muted)] text-sm mb-8">
          Check back later or continue with the module lessons!
        </p>
        <Link
          href="/dashboard/kid"
          className="inline-block px-6 py-3 rounded-lg font-semibold text-sm text-[#0f0f0f]"
          style={{ background: 'linear-gradient(135deg, #4ECDC4, #6BCF7F)' }}
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Results screen
  if (showResult && quizResult) {
    const passed = quizResult.passed;

    return (
      <div className="max-w-lg mx-auto text-center py-12">
        {/* Confetti-like effect for passing */}
        {passed && (
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
        )}

        <div
          className="rounded-2xl p-10 mb-8"
          style={{
            background: passed
              ? 'linear-gradient(135deg, rgba(107,207,127,0.15), rgba(78,205,196,0.15))'
              : 'linear-gradient(135deg, rgba(255,107,107,0.1), rgba(255,217,61,0.1))',
            border: `1px solid ${passed ? 'rgba(107,207,127,0.3)' : 'rgba(255,217,61,0.3)'}`,
          }}
        >
          <div className="text-5xl mb-4">{passed ? '🏆' : '💪'}</div>
          <h1 className="font-mono text-3xl font-bold mb-2">
            {passed ? 'You Passed!' : 'Almost There!'}
          </h1>
          <p className="text-[var(--muted)] mb-6">{quizResult.message}</p>

          {/* Score display */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="text-center">
              <p className="font-mono text-5xl font-bold" style={{ color: passed ? '#6BCF7F' : '#FFD93D' }}>
                {quizResult.score}/{questions.length}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {passingScore}/{questions.length} needed to pass
              </p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: questions.length }).map((_, i) => (
              <span key={i} className="text-2xl">
                {i < quizResult.score ? '⭐' : '☆'}
              </span>
            ))}
          </div>

          {passed && quizResult.nextModuleTitle && (
            <div className="bg-[var(--card)] rounded-xl p-4 mt-4">
              <p className="text-sm font-semibold text-[#4ECDC4]">
                Next up: {quizResult.nextModuleTitle}
              </p>
            </div>
          )}
        </div>

        <Link
          href="/dashboard/kid"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-sm text-[#0f0f0f]"
          style={{ background: passed
            ? 'linear-gradient(135deg, #6BCF7F, #4ECDC4)'
            : 'linear-gradient(135deg, #FF6B6B, #FFD93D)'
          }}
        >
          {passed ? 'Back to Dashboard' : "Let's Keep Learning"}
        </Link>
      </div>
    );
  }

  // Quiz in progress
  const question = questions[currentQuestion];
  const isCorrect = selectedAnswer === question.correctAnswer;
  const progressPercent = ((currentQuestion) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard/kid" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="font-mono text-2xl font-bold mt-1">
            Skip Ahead: {moduleTitle}
          </h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">
            {currentQuestion + 1}/{questions.length}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Need {passingScore}/{questions.length} to pass
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[var(--border)] rounded-full mb-8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
            background: 'linear-gradient(135deg, #4ECDC4, #6BCF7F)',
          }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 mb-6">
        <p className="text-lg font-semibold mb-6">{question.question}</p>

        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const letterLabel = String.fromCharCode(65 + index); // A, B, C, D

            let borderColor = 'border-[var(--border)]';
            let bgColor = 'bg-[var(--background)]';

            if (showExplanation && isSelected) {
              if (isCorrect) {
                borderColor = 'border-[#6BCF7F]';
                bgColor = 'bg-[#6BCF7F]/10';
              } else {
                borderColor = 'border-[#FF6B6B]';
                bgColor = 'bg-[#FF6B6B]/10';
              }
            } else if (showExplanation && option === question.correctAnswer) {
              borderColor = 'border-[#6BCF7F]';
              bgColor = 'bg-[#6BCF7F]/10';
            } else if (isSelected) {
              borderColor = 'border-[#4ECDC4]';
              bgColor = 'bg-[#4ECDC4]/10';
            }

            return (
              <button
                key={option}
                onClick={() => !showExplanation && selectAnswer(option)}
                disabled={showExplanation}
                className={`w-full text-left p-4 rounded-xl border ${borderColor} ${bgColor} transition-all ${
                  !showExplanation ? 'hover:border-[#4ECDC4] hover:bg-[#4ECDC4]/5 cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected && !showExplanation
                      ? 'bg-[#4ECDC4] text-[#0f0f0f]'
                      : showExplanation && option === question.correctAnswer
                        ? 'bg-[#6BCF7F] text-[#0f0f0f]'
                        : showExplanation && isSelected && !isCorrect
                          ? 'bg-[#FF6B6B] text-white'
                          : 'bg-[var(--card)] text-[var(--muted)]'
                  }`}>
                    {letterLabel}
                  </span>
                  <span className="flex-1">{option}</span>
                  {showExplanation && option === question.correctAnswer && (
                    <span className="text-[#6BCF7F]">✓</span>
                  )}
                  {showExplanation && isSelected && !isCorrect && (
                    <span className="text-[#FF6B6B]">✗</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className={`mt-6 p-4 rounded-xl ${
            isCorrect
              ? 'bg-[#6BCF7F]/10 border border-[#6BCF7F]/30'
              : 'bg-[#FFD93D]/10 border border-[#FFD93D]/30'
          }`}>
            <p className="text-sm font-semibold mb-1">
              {isCorrect ? '✅ Correct!' : '❌ Not quite!'}
            </p>
            <p className="text-sm text-[var(--muted)]">{question.explanation}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {!showExplanation ? (
          <button
            onClick={confirmAnswer}
            disabled={!selectedAnswer}
            className="flex-1 py-4 rounded-xl font-semibold text-sm text-[#0f0f0f] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #4ECDC4, #6BCF7F)' }}
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            disabled={submitting}
            className="flex-1 py-4 rounded-xl font-semibold text-sm text-[#0f0f0f] disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #4ECDC4, #6BCF7F)' }}
          >
            {submitting
              ? 'Submitting...'
              : currentQuestion < questions.length - 1
                ? 'Next Question →'
                : 'See Results'}
          </button>
        )}
      </div>

      {/* Question indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i === currentQuestion
                ? 'bg-[#4ECDC4] scale-125'
                : i < currentQuestion
                  ? answers[i] === questions[i].correctAnswer
                    ? 'bg-[#6BCF7F]'
                    : 'bg-[#FF6B6B]'
                  : 'bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
