-- Migration to fix onboarding persistence
-- Created: 2026-02-08

-- 1. Ensure the column has the correct default
ALTER TABLE profiles 
ALTER COLUMN onboarding_completed SET DEFAULT false;

-- 2. Update the RLS policy for profiles to strictly allow updates
-- We drop the existing policy to avoid conflicts/duplicates and ensure the correct one is active
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Verify permissions (ensure authenticated users can update the profiles table)
GRANT UPDATE ON TABLE profiles TO authenticated;
