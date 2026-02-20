-- Migration: Add family code + kid PIN support
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bmstgwlnbohcbldpxwnh/sql/new

-- Add family_code to profiles (6-digit code for the family)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_code TEXT UNIQUE;

-- Add kid_pin to children (4-digit PIN for each child)
ALTER TABLE children ADD COLUMN IF NOT EXISTS kid_pin TEXT;

-- Create index for fast family code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_family_code ON profiles(family_code);

-- Allow anyone to look up a profile by family_code (needed for kid login)
-- But only return the family_code match, not other data
CREATE OR REPLACE FUNCTION public.kid_login(p_family_code TEXT, p_kid_pin TEXT)
RETURNS JSON AS $$
DECLARE
  v_parent_id UUID;
  v_child RECORD;
BEGIN
  -- Find parent by family code
  SELECT id INTO v_parent_id
  FROM profiles
  WHERE family_code = p_family_code AND role = 'parent';

  IF v_parent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid family code');
  END IF;

  -- Find child by PIN under that parent
  SELECT id, name, avatar_emoji, age, grade INTO v_child
  FROM children
  WHERE parent_id = v_parent_id AND kid_pin = p_kid_pin;

  IF v_child.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  RETURN json_build_object(
    'success', true,
    'child_id', v_child.id,
    'child_name', v_child.name,
    'avatar_emoji', v_child.avatar_emoji,
    'parent_id', v_parent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
