'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Lesson } from '@/types/database';
import { CURRICULUM_CATALOG } from '@/data/curriculum';

type SubjectFilter = 'all' | 'math' | 'reading';

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filter, setFilter] = useState<SubjectFilter>('all');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .order('order_index');

    setLessons(data || []);
    setLoading(false);
  }

  const filteredLessons = filter === 'all' ? lessons : lessons.filter((l) => l.subject === filter);

  // If no DB lessons, show curriculum catalog
  const showCatalog = !loading && lessons.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono text-4xl font-bold mb-2">Lessons</h1>
        <p className="text-[var(--muted)]">Interactive lessons across Math and Reading</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-8">
        {(['all', 'math', 'reading'] as SubjectFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              filter === f
                ? 'text-[#0f0f0f]'
                : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-hover)]'
            }`}
            style={
              filter === f
                ? { background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }
                : {}
            }
          >
            {f === 'all' ? 'All Subjects' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--muted)]">Loading lessons...</div>
      ) : showCatalog ? (
        /* Show curriculum catalog when no DB lessons */
        <div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 mb-8">
            <p className="text-sm text-[var(--muted)]">
              No lessons uploaded yet. Below is the curriculum catalog showing available modules.
              Upload lessons to Supabase to make them interactive.
            </p>
          </div>

          {CURRICULUM_CATALOG
            .filter((m) => filter === 'all' || m.subject === filter)
            .map((module) => (
            <div key={module.id} className="mb-8">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                {module.icon} {module.title}
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)] capitalize">
                  {module.subject}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)]">
                  {module.grades}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {module.chapters.map((chapter, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--foreground)]/20 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-full bg-[var(--card-hover)] flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold">{chapter}</h3>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {module.duration} &middot; {module.activities} activities
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* DB lessons grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/lessons/${lesson.id}`}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all block group"
            >
              <span className="text-4xl mb-4 block">
                {lesson.subject === 'math' ? '📐' : '📖'}
              </span>
              <h3 className="font-semibold mb-1 group-hover:text-[#FF6B6B] transition-colors">
                {lesson.title}
              </h3>
              <p className="text-xs text-[var(--muted)] mb-4 line-clamp-2">{lesson.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-[var(--card-hover)] text-[var(--muted)]">
                  {lesson.duration_minutes}m
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-[var(--card-hover)] text-[var(--muted)] capitalize">
                  {lesson.difficulty}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-[var(--card-hover)] text-[var(--muted)]">
                  Grade {lesson.grade_level}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
