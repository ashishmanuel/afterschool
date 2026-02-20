// Activity type is now dynamic (not limited to math/reading/chores)
export type ActivityType = string;
export type UserRole = 'parent' | 'kid';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type RingType = 'curriculum' | 'custom_timed';

// Known subjects for color/icon defaults
export const KNOWN_SUBJECTS = ['math', 'reading'] as const;
export type KnownSubject = (typeof KNOWN_SUBJECTS)[number];

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_emoji: string;
  family_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age: number;
  grade: string;
  avatar_emoji: string;
  kid_pin: string | null;
  created_at: string;
}

// Kid session stored in localStorage (not Supabase Auth)
export interface KidSession {
  child_id: string;
  child_name: string;
  avatar_emoji: string;
  parent_id: string;
  logged_in_at: string;
}

// ============================================
// RING ASSIGNMENTS (dynamic activity rings)
// ============================================
export interface RingAssignment {
  id: string;
  child_id: string;
  ring_slot: 1 | 2 | 3;
  ring_type: RingType;
  module_id: number | null;
  subject: string | null;
  custom_label: string | null;
  custom_icon: string | null;
  color: string;
  daily_goal_minutes: number;
  auto_assigned: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to get the display label for a ring
export function getRingLabel(ring: RingAssignment): string {
  if (ring.ring_type === 'custom_timed') {
    return ring.custom_label || 'Activity';
  }
  return ring.subject
    ? ring.subject.charAt(0).toUpperCase() + ring.subject.slice(1)
    : 'Subject';
}

// Helper to get the display icon for a ring
export function getRingIcon(ring: RingAssignment): string {
  if (ring.ring_type === 'custom_timed') {
    return ring.custom_icon || '⏱️';
  }
  const subjectIcons: Record<string, string> = {
    math: '📐',
    reading: '📖',
    science: '🔬',
  };
  return subjectIcons[ring.subject || ''] || '📚';
}

// ============================================
// MODULE PROGRESS
// ============================================
export interface ModuleProgress {
  id: string;
  child_id: string;
  module_id: number;
  current_chapter: number;
  is_completed: boolean;
  skipped_via_quiz: boolean;
  quiz_score: number | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================
// PLACEMENT QUIZZES
// ============================================
export interface PlacementQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface PlacementQuiz {
  id: string;
  module_id: number;
  questions: PlacementQuizQuestion[];
  passing_score: number;
}

// ============================================
// EXISTING TYPES (updated for dynamic rings)
// ============================================
export interface ActivityGoal {
  id: string;
  child_id: string;
  activity_type: ActivityType;
  daily_goal_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  child_id: string;
  activity_type: ActivityType;
  minutes: number;
  points_earned: number;
  lesson_id: string | null;
  logged_date: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  description: string;
  duration_minutes: number;
  difficulty: Difficulty;
  content_json: LessonContent;
  content_html: string;
  module_id: number;
  chapter_number: number;
  order_index: number;
  created_at: string;
}

export interface LessonContent {
  hook: {
    scenario: string;
    question: string;
  };
  explore: {
    activity: string;
    guideQuestions: string[];
  };
  teach: {
    explanation: string;
    examples: {
      problem: string;
      solution: string;
      visual: string;
    }[];
    vocabulary: string[];
    commonMistakes: string[];
  };
  practice: {
    problems: {
      problem: string;
      difficulty: Difficulty;
      solution: string;
      hint: string;
    }[];
  };
  wrapup: {
    recap: string;
    realWorld: string;
    nextLesson: string;
  };
}

export interface LessonProgress {
  id: string;
  child_id: string;
  lesson_id: string;
  started_at: string;
  completed_at: string | null;
  time_spent_seconds: number;
  score: number | null;
  problems_correct: number;
  problems_total: number;
}

export interface Streak {
  id: string;
  child_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  child_id: string;
  badge_name: string;
  badge_icon: string;
  description: string;
  earned_at: string;
}

export interface QuizQuestion {
  type: 'multiple-choice' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hints: string[];
  difficulty: Difficulty;
}

// ============================================
// DASHBOARD AGGREGATE TYPES (ring-aware)
// ============================================
export interface DailyProgress {
  ring_slot: number;
  ring_label: string;
  ring_color: string;
  ring_icon: string;
  activity_type: string;
  total_minutes: number;
  goal_minutes: number;
  percentage: number;
}

export interface ChildWithProgress extends Child {
  streak: Streak | null;
  ring_assignments: RingAssignment[];
  daily_progress: DailyProgress[];
  total_points: number;
}

export interface WeeklyRing {
  date: string;
  rings: { slot: number; percentage: number; color: string }[];
}
