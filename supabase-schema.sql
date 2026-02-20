-- After School Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
  avatar_emoji TEXT DEFAULT '👤',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- CHILDREN
-- ============================================
CREATE TABLE children (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 3 AND age <= 18),
  grade TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧒',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can read own children"
  ON children FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert children"
  ON children FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update own children"
  ON children FOR UPDATE
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete own children"
  ON children FOR DELETE
  USING (auth.uid() = parent_id);

-- ============================================
-- ACTIVITY GOALS
-- ============================================
CREATE TABLE activity_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('math', 'reading', 'chores')),
  daily_goal_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, activity_type)
);

ALTER TABLE activity_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage goals for own children"
  ON activity_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = activity_goals.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- ============================================
-- ACTIVITY LOGS
-- ============================================
CREATE TABLE activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('math', 'reading', 'chores')),
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  points_earned INTEGER DEFAULT 0,
  lesson_id UUID NULL,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_child_date ON activity_logs(child_id, logged_date);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage logs for own children"
  ON activity_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = activity_logs.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- ============================================
-- LESSONS
-- ============================================
CREATE TABLE lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'reading')),
  grade_level TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  content_json JSONB,
  content_html TEXT,
  module_id INTEGER,
  chapter_number INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lessons are readable by all authenticated users"
  ON lessons FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- LESSON PROGRESS
-- ============================================
CREATE TABLE lesson_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER DEFAULT 0,
  score INTEGER,
  problems_correct INTEGER DEFAULT 0,
  problems_total INTEGER DEFAULT 0,
  UNIQUE(child_id, lesson_id)
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage progress for own children"
  ON lesson_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = lesson_progress.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- ============================================
-- STREAKS
-- ============================================
CREATE TABLE streaks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage streaks for own children"
  ON streaks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = streaks.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- ============================================
-- ACHIEVEMENTS
-- ============================================
CREATE TABLE achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  badge_name TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can read achievements for own children"
  ON achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = achievements.child_id
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "System can insert achievements"
  ON achievements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = achievements.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_emoji)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '👤')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HELPER FUNCTION: Auto-create default goals for new children
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_child()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default goals (30 min each)
  INSERT INTO public.activity_goals (child_id, activity_type, daily_goal_minutes)
  VALUES
    (NEW.id, 'math', 30),
    (NEW.id, 'reading', 30),
    (NEW.id, 'chores', 15);

  -- Create streak record
  INSERT INTO public.streaks (child_id, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_child_created
  AFTER INSERT ON children
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_child();
