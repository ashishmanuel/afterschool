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

  // Get module IDs that have actual DB lessons
  const moduleIdsWithLessons = new Set(lessons.map((l) => l.module_id));

  // Filter catalog by subject
  const filteredCatalog = CURRICULUM_CATALOG.filter(
    (m) => filter === 'all' || m.subject === filter
  );
  const mathModules = filteredCatalog.filter((m) => m.subject === 'math');
  const readingModules = filteredCatalog.filter((m) => m.subject === 'reading');

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
      ) : (
        <>
          {/* ===================== */}
          {/* AVAILABLE LESSONS     */}
          {/* ===================== */}
          {filteredLessons.length > 0 && (
            <div className="mb-12">
              <h2 className="font-mono text-xl font-bold mb-2 flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs"
                  style={{ background: 'rgba(107,207,127,0.15)', color: '#6BCF7F' }}
                >
                  ✓
                </span>
                Available Now
              </h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                These lessons are ready to play — tap to start learning!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--foreground)]/20 transition-all block group relative overflow-hidden"
                  >
                    <div
                      className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(107,207,127,0.15)',
                        color: '#6BCF7F',
                        border: '1px solid rgba(107,207,127,0.3)',
                      }}
                    >
                      Play
                    </div>
                    <span className="text-4xl mb-4 block">
                      {lesson.subject === 'math' ? '📐' : '📖'}
                    </span>
                    <h3 className="font-semibold mb-1 group-hover:text-[#FF6B6B] transition-colors">
                      {lesson.title}
                    </h3>
                    <p className="text-xs text-[var(--muted)] mb-4 line-clamp-2">
                      {lesson.description}
                    </p>
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
            </div>
          )}

          {/* ===================== */}
          {/* CURRICULUM ROADMAP    */}
          {/* ===================== */}
          <div>
            <div className="mb-8">
              <h2 className="font-mono text-xl font-bold mb-2 flex items-center gap-2">
                🗺️ Curriculum Roadmap
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {CURRICULUM_CATALOG.length} modules across Math &amp; Reading &middot; Kindergarten through Grade 6
              </p>
            </div>

            {/* Math Modules */}
            {mathModules.length > 0 && (
              <div className="mb-10">
                <h3 className="font-mono text-base font-bold mb-4 flex items-center gap-2">
                  📐 Math
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)]">
                    {mathModules.length} modules
                  </span>
                </h3>
                <div className="space-y-4">
                  {mathModules.map((mod) => {
                    const hasLessons = moduleIdsWithLessons.has(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className="bg-[var(--card)] border rounded-xl p-5 transition-all hover:border-[var(--foreground)]/20"
                        style={{
                          borderColor: hasLessons
                            ? 'rgba(107,207,127,0.4)'
                            : 'var(--border)',
                          background: hasLessons
                            ? 'linear-gradient(135deg, rgba(107,207,127,0.05), transparent)'
                            : undefined,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-3xl flex-shrink-0">{mod.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-semibold text-sm">{mod.title}</h4>
                              {hasLessons ? (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(107,207,127,0.15)',
                                    color: '#6BCF7F',
                                    border: '1px solid rgba(107,207,127,0.3)',
                                  }}
                                >
                                  Available
                                </span>
                              ) : (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(255,217,61,0.15)',
                                    color: '#FFD93D',
                                    border: '1px solid rgba(255,217,61,0.3)',
                                  }}
                                >
                                  Coming Soon
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--muted)] mb-3">
                              <span>{mod.grades}</span>
                              <span>&middot;</span>
                              <span>{mod.duration}</span>
                              <span>&middot;</span>
                              <span>{mod.activities} activities</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {mod.chapters.map((chapter, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--card-hover)] text-[var(--muted)]"
                                >
                                  {idx + 1}. {chapter}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reading Modules */}
            {readingModules.length > 0 && (
              <div className="mb-10">
                <h3 className="font-mono text-base font-bold mb-4 flex items-center gap-2">
                  📖 Reading
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)]">
                    {readingModules.length} modules
                  </span>
                </h3>
                <div className="space-y-4">
                  {readingModules.map((mod) => {
                    const hasLessons = moduleIdsWithLessons.has(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className="bg-[var(--card)] border rounded-xl p-5 transition-all hover:border-[var(--foreground)]/20"
                        style={{
                          borderColor: hasLessons
                            ? 'rgba(107,207,127,0.4)'
                            : 'var(--border)',
                          background: hasLessons
                            ? 'linear-gradient(135deg, rgba(107,207,127,0.05), transparent)'
                            : undefined,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-3xl flex-shrink-0">{mod.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-semibold text-sm">{mod.title}</h4>
                              {hasLessons ? (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(107,207,127,0.15)',
                                    color: '#6BCF7F',
                                    border: '1px solid rgba(107,207,127,0.3)',
                                  }}
                                >
                                  Available
                                </span>
                              ) : (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(255,217,61,0.15)',
                                    color: '#FFD93D',
                                    border: '1px solid rgba(255,217,61,0.3)',
                                  }}
                                >
                                  Coming Soon
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--muted)] mb-3">
                              <span>{mod.grades}</span>
                              <span>&middot;</span>
                              <span>{mod.duration}</span>
                              <span>&middot;</span>
                              <span>{mod.activities} activities</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {mod.chapters.map((chapter, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--card-hover)] text-[var(--muted)]"
                                >
                                  {idx + 1}. {chapter}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
