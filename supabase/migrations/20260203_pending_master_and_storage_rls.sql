-- Migration: Add pending_master role support and fix storage RLS policies
-- Created: 2026-02-03

-- ============================================
-- PART 1: Update profiles table to support pending_master role
-- ============================================

-- Add comment to document the new role
COMMENT ON COLUMN profiles.role IS 'User role: client, pending_master, master, or owner. pending_master = applying for master with client features.';

-- ============================================
-- PART 2: Update RLS policies for profiles to include pending_master
-- ============================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Recreate with pending_master support
CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Policy for masters/owners to view all profiles (includes pending_master)
DROP POLICY IF EXISTS "Masters and owners can view all profiles" ON profiles;
CREATE POLICY "Masters and owners can view all profiles" 
ON profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('master', 'owner')
  )
);

-- ============================================
-- PART 3: Fix Storage RLS Policies for master-portfolios bucket
-- ============================================

-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('master-portfolios', 'master-portfolios', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload their own portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view their own portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to master-portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated selects from master-portfolios" ON storage.objects;

-- Policy 1: Allow authenticated users to upload to their own folder
-- Users can only upload to portfolio/{user_id}/ path
CREATE POLICY "Allow authenticated uploads to master-portfolios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'master-portfolios' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to select/view their own files
CREATE POLICY "Allow authenticated selects from master-portfolios"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'master-portfolios'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow service role to manage all files (for admin/edge functions)
CREATE POLICY "Service role can manage all portfolios"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'master-portfolios')
WITH CHECK (bucket_id = 'master-portfolios');

-- Policy 4: Allow public access to view portfolio images (for displaying in app)
CREATE POLICY "Public can view portfolio images"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'master-portfolios');

-- ============================================
-- PART 4: Create function to check if role is valid
-- ============================================

CREATE OR REPLACE FUNCTION public.is_valid_role(role_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN role_text IN ('client', 'pending_master', 'master', 'owner');
END;
$$;

-- ============================================
-- PART 5: Update existing constraints if needed
-- ============================================

-- Add check constraint for valid roles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_role_check'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT valid_role_check 
    CHECK (role IN ('client', 'pending_master', 'master', 'owner'));
  END IF;
END $$;

-- ============================================
-- PART 6: Create index for role-based queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role);

-- ============================================
-- PART 7: Update master_applications table
-- ============================================

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_applications_profile_id 
ON master_applications(profile_id);

CREATE INDEX IF NOT EXISTS idx_master_applications_status 
ON master_applications(status);

-- ============================================
-- NOTES:
-- ============================================
-- pending_master role users:
-- - Have access to all client features
-- - Can complete their master application
-- - Can be promoted to 'master' on approval
-- - Can be demoted to 'client' on rejection
-- 
-- Storage policies allow:
-- - Users to upload only to their own folder (portfolio/{user_id}/)
-- - Public access to view all portfolio images
-- - Service role to manage all files for admin purposes
