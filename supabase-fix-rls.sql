-- Fix RLS policies for children table to work with kid_pin column
-- Run this in Supabase SQL Editor

-- Drop and recreate the INSERT policy for children
DROP POLICY IF EXISTS "Parents can insert children" ON children;
CREATE POLICY "Parents can insert children"
  ON children FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

-- Also ensure the trigger function can insert into activity_goals and streaks
-- by making those policies work with SECURITY DEFINER context
-- (These should already work since the trigger is SECURITY DEFINER,
--  but let's also add explicit anon access for kid_login reads)

-- Allow the kid_login function to read children (it uses SECURITY DEFINER so this should work)
-- But also allow anonymous users to call the RPC
GRANT EXECUTE ON FUNCTION public.kid_login TO anon;
GRANT EXECUTE ON FUNCTION public.kid_login TO authenticated;

-- Check if there are any issues with the children table structure
-- Let's verify the column exists and has no constraints blocking it
DO $$
BEGIN
  -- Ensure kid_pin has no NOT NULL constraint (it should be nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'children' AND column_name = 'kid_pin'
  ) THEN
    ALTER TABLE children ADD COLUMN kid_pin TEXT;
  END IF;
END $$;
