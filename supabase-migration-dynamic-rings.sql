-- Migration: Dynamic Activity Rings, Module Progress, Placement Quizzes
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bmstgwlnbohcbldpxwnh/sql/new

-- ============================================
-- 1. NEW TABLE: ring_assignments
-- ============================================
CREATE TABLE IF NOT EXISTS ring_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  ring_slot INTEGER NOT NULL CHECK (ring_slot >= 1 AND ring_slot <= 3),
  ring_type TEXT NOT NULL CHECK (ring_type IN ('curriculum', 'custom_timed')),
  module_id INTEGER,
  subject TEXT,
  custom_label TEXT,
  custom_icon TEXT,
  color TEXT NOT NULL,
  daily_goal_minutes INTEGER NOT NULL DEFAULT 30,
  auto_assigned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, ring_slot)
);

ALTER TABLE ring_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage ring assignments for own children"
  ON ring_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = ring_assignments.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- Allow anon to read ring assignments (needed for kid login sessions)
CREATE POLICY "Anyone can read ring assignments"
  ON ring_assignments FOR SELECT
  USING (true);

-- ============================================
-- 2. NEW TABLE: module_progress
-- ============================================
CREATE TABLE IF NOT EXISTS module_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  module_id INTEGER NOT NULL,
  current_chapter INTEGER DEFAULT 1,
  is_completed BOOLEAN DEFAULT FALSE,
  skipped_via_quiz BOOLEAN DEFAULT FALSE,
  quiz_score INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(child_id, module_id)
);

ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage module progress for own children"
  ON module_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = module_progress.child_id
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read module progress"
  ON module_progress FOR SELECT
  USING (true);

-- ============================================
-- 3. NEW TABLE: placement_quizzes
-- ============================================
CREATE TABLE IF NOT EXISTS placement_quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  module_id INTEGER NOT NULL UNIQUE,
  questions JSONB NOT NULL,
  passing_score INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE placement_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quizzes are readable by everyone"
  ON placement_quizzes FOR SELECT
  USING (true);

-- ============================================
-- 4. DROP hardcoded CHECK constraints
-- ============================================

-- activity_goals: remove fixed activity_type constraint
DO $$
BEGIN
  ALTER TABLE activity_goals DROP CONSTRAINT IF EXISTS activity_goals_activity_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- activity_logs: remove fixed activity_type constraint
DO $$
BEGIN
  ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_activity_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- lessons: remove fixed subject constraint
DO $$
BEGIN
  ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_subject_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================
-- 5. REPLACE handle_new_child trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_child()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default ring assignments:
  -- Ring 1: Math (curriculum, auto-assigned)
  -- Ring 2: Reading (curriculum, auto-assigned)
  -- Ring 3: Chores (custom timed)
  INSERT INTO public.ring_assignments (child_id, ring_slot, ring_type, subject, module_id, color, daily_goal_minutes, auto_assigned, custom_label, custom_icon)
  VALUES
    (NEW.id, 1, 'curriculum', 'math', NULL, '#FF6B6B', 30, TRUE, NULL, NULL),
    (NEW.id, 2, 'curriculum', 'reading', NULL, '#4ECDC4', 30, TRUE, NULL, NULL),
    (NEW.id, 3, 'custom_timed', NULL, NULL, '#6BCF7F', 15, FALSE, 'Chores', '🧹');

  -- Create matching activity goals
  INSERT INTO public.activity_goals (child_id, activity_type, daily_goal_minutes)
  VALUES
    (NEW.id, 'ring_1', 30),
    (NEW.id, 'ring_2', 30),
    (NEW.id, 'ring_3', 15);

  -- Create streak record
  INSERT INTO public.streaks (child_id, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. BACKFILL: Create ring_assignments for existing children
-- ============================================
INSERT INTO ring_assignments (child_id, ring_slot, ring_type, subject, color, daily_goal_minutes, auto_assigned, custom_label, custom_icon)
SELECT c.id, 1, 'curriculum', 'math', '#FF6B6B', 30, TRUE, NULL, NULL
FROM children c
WHERE NOT EXISTS (SELECT 1 FROM ring_assignments ra WHERE ra.child_id = c.id AND ra.ring_slot = 1);

INSERT INTO ring_assignments (child_id, ring_slot, ring_type, subject, color, daily_goal_minutes, auto_assigned, custom_label, custom_icon)
SELECT c.id, 2, 'curriculum', 'reading', '#4ECDC4', 30, TRUE, NULL, NULL
FROM children c
WHERE NOT EXISTS (SELECT 1 FROM ring_assignments ra WHERE ra.child_id = c.id AND ra.ring_slot = 2);

INSERT INTO ring_assignments (child_id, ring_slot, ring_type, subject, color, daily_goal_minutes, auto_assigned, custom_label, custom_icon)
SELECT c.id, 3, 'custom_timed', NULL, '#6BCF7F', 15, FALSE, 'Chores', '🧹'
FROM children c
WHERE NOT EXISTS (SELECT 1 FROM ring_assignments ra WHERE ra.child_id = c.id AND ra.ring_slot = 3);

-- ============================================
-- 7. SEED: Placement quiz data for key modules
-- ============================================
INSERT INTO placement_quizzes (module_id, questions, passing_score) VALUES
(1, '[
  {"question": "What number comes after 7?", "options": ["6", "8", "9", "5"], "correctAnswer": "8", "explanation": "When counting up, the number after 7 is 8."},
  {"question": "Count the stars: * * * * *. How many?", "options": ["4", "5", "6", "3"], "correctAnswer": "5", "explanation": "There are 5 stars in the group."},
  {"question": "Which number is bigger: 12 or 9?", "options": ["9", "12", "They are equal", "Cannot tell"], "correctAnswer": "12", "explanation": "12 is bigger than 9 because it comes later when counting."},
  {"question": "What number comes before 15?", "options": ["16", "13", "14", "10"], "correctAnswer": "14", "explanation": "When counting, 14 comes right before 15."},
  {"question": "How many fingers do you have on two hands?", "options": ["5", "8", "10", "20"], "correctAnswer": "10", "explanation": "You have 5 fingers on each hand, so 5 + 5 = 10."}
]'::jsonb, 4),

(2, '[
  {"question": "What is 3 + 4?", "options": ["6", "7", "8", "5"], "correctAnswer": "7", "explanation": "3 + 4 = 7. You can count up 4 from 3: 4, 5, 6, 7."},
  {"question": "What is 8 + 5?", "options": ["12", "13", "14", "11"], "correctAnswer": "13", "explanation": "8 + 5 = 13. Think of it as 8 + 2 = 10, then 10 + 3 = 13."},
  {"question": "If you have 6 apples and get 4 more, how many do you have?", "options": ["8", "9", "10", "11"], "correctAnswer": "10", "explanation": "6 + 4 = 10 apples total."},
  {"question": "What is 9 + 9?", "options": ["17", "18", "19", "16"], "correctAnswer": "18", "explanation": "9 + 9 = 18. Double 9 is 18."},
  {"question": "7 + ? = 10. What goes in the blank?", "options": ["2", "3", "4", "5"], "correctAnswer": "3", "explanation": "7 + 3 = 10. The number bond for 10 is 7 and 3."}
]'::jsonb, 4),

(4, '[
  {"question": "What is 6 x 3?", "options": ["15", "18", "21", "12"], "correctAnswer": "18", "explanation": "6 x 3 = 18. Think of 3 groups of 6."},
  {"question": "What is 7 x 5?", "options": ["30", "35", "40", "25"], "correctAnswer": "35", "explanation": "7 x 5 = 35. Count by 5s seven times: 5, 10, 15, 20, 25, 30, 35."},
  {"question": "If there are 4 rows of 8 chairs, how many chairs total?", "options": ["24", "28", "32", "36"], "correctAnswer": "32", "explanation": "4 x 8 = 32 chairs."},
  {"question": "What is 9 x 4?", "options": ["32", "36", "40", "28"], "correctAnswer": "36", "explanation": "9 x 4 = 36. Think of (10 x 4) - 4 = 40 - 4 = 36."},
  {"question": "Which multiplication fact equals 24?", "options": ["3 x 7", "4 x 6", "5 x 5", "2 x 11"], "correctAnswer": "4 x 6", "explanation": "4 x 6 = 24. You can also think of it as 6 x 4."}
]'::jsonb, 4),

(16, '[
  {"question": "What sound does the letter B make?", "options": ["/b/ as in ball", "/d/ as in dog", "/p/ as in pig", "/g/ as in go"], "correctAnswer": "/b/ as in ball", "explanation": "The letter B makes the /b/ sound, like in ball, bat, and bed."},
  {"question": "Which word rhymes with cat?", "options": ["dog", "hat", "cup", "run"], "correctAnswer": "hat", "explanation": "Hat rhymes with cat because they both end with the -at sound."},
  {"question": "What is the first sound in the word sun?", "options": ["/s/", "/u/", "/n/", "/r/"], "correctAnswer": "/s/", "explanation": "The first sound in sun is /s/."},
  {"question": "Which word has 3 sounds: d-o-g?", "options": ["go", "dog", "dogs", "do"], "correctAnswer": "dog", "explanation": "Dog has 3 sounds: /d/ /o/ /g/."},
  {"question": "Blend these sounds together: /c/ /a/ /t/. What word?", "options": ["bat", "cat", "hat", "sat"], "correctAnswer": "cat", "explanation": "When you blend /c/ /a/ /t/ together, you get the word cat."}
]'::jsonb, 4),

(17, '[
  {"question": "What is a sight word?", "options": ["A word you can see far away", "A word you read by memory", "A very long word", "A word with pictures"], "correctAnswer": "A word you read by memory", "explanation": "Sight words are common words we learn to recognize instantly without sounding them out."},
  {"question": "Which of these is a complete sentence?", "options": ["The big dog", "Running fast", "The cat sat on the mat.", "Blue and red"], "correctAnswer": "The cat sat on the mat.", "explanation": "A complete sentence has a subject (the cat) and tells what happened (sat on the mat)."},
  {"question": "Read this sentence: The boy ran fast. Who ran?", "options": ["The girl", "The dog", "The boy", "The cat"], "correctAnswer": "The boy", "explanation": "The sentence says The boy ran fast, so the boy is who ran."},
  {"question": "Which word means the same as happy?", "options": ["Sad", "Glad", "Mad", "Tired"], "correctAnswer": "Glad", "explanation": "Glad means happy or pleased."},
  {"question": "What comes at the end of a telling sentence?", "options": ["Question mark (?)", "Period (.)", "Exclamation mark (!)", "Comma (,)"], "correctAnswer": "Period (.)", "explanation": "A telling sentence (statement) ends with a period."}
]'::jsonb, 4)

ON CONFLICT (module_id) DO NOTHING;
