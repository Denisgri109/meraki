-- Migration: Fix user deletion by adding cascade delete trigger
-- This allows deleting users from Supabase Auth dashboard without foreign key errors
-- Created: 2026-02-03

-- ============================================
-- PART 1: Create function to delete user data
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile_id UUID;
BEGIN
    -- Get the profile ID for the user being deleted
    SELECT id INTO user_profile_id
    FROM public.profiles
    WHERE id = OLD.id;
    
    -- If no profile exists, nothing to do
    IF user_profile_id IS NULL THEN
        RETURN OLD;
    END IF;
    
    -- Delete master applications related to this user
    DELETE FROM public.master_applications 
    WHERE profile_id = user_profile_id;
    
    -- Delete photo consultations where user is client or master
    DELETE FROM public.photo_consultations 
    WHERE client_id = user_profile_id OR master_id = user_profile_id;
    
    -- Delete academy submissions
    DELETE FROM public.academy_submissions 
    WHERE student_id = user_profile_id OR graded_by = user_profile_id;
    
    -- Delete course enrollments
    DELETE FROM public.course_enrollments 
    WHERE student_id = user_profile_id;
    
    -- Delete homework submissions
    DELETE FROM public.homework_submissions 
    WHERE student_id = user_profile_id OR reviewed_by = user_profile_id;
    
    -- Delete lesson progress
    DELETE FROM public.lesson_progress 
    WHERE user_id = user_profile_id;
    
    -- Delete loyalty data
    DELETE FROM public.loyalty_qr_codes 
    WHERE user_id = user_profile_id;
    
    DELETE FROM public.loyalty_transactions 
    WHERE user_id = user_profile_id;
    
    -- Delete master availability
    DELETE FROM public.master_availability 
    WHERE master_id = user_profile_id;
    
    -- Delete master services
    DELETE FROM public.master_services 
    WHERE master_id = user_profile_id;
    
    -- Delete portfolios
    DELETE FROM public.portfolios 
    WHERE master_id = user_profile_id;
    
    -- Delete orders
    DELETE FROM public.orders 
    WHERE user_id = user_profile_id;
    
    -- Delete payment methods
    DELETE FROM public.payment_methods 
    WHERE user_id = user_profile_id;
    
    -- Delete scheduled notifications
    DELETE FROM public.scheduled_notifications 
    WHERE user_id = user_profile_id;
    
    -- Delete user credits
    DELETE FROM public.user_credits 
    WHERE user_id = user_profile_id;
    
    -- Delete blocked slots
    DELETE FROM public.blocked_slots 
    WHERE master_id = user_profile_id;
    
    -- Handle appointments - set to 'cancelled' status rather than delete for audit trail
    UPDATE public.appointments 
    SET status = 'cancelled', 
        updated_at = NOW()
    WHERE client_id = user_profile_id OR master_id = user_profile_id;
    
    -- Handle payments - don't delete for financial records, just anonymize user reference
    UPDATE public.payments 
    SET user_id = NULL
    WHERE user_id = user_profile_id;
    
    -- Handle payouts - don't delete for financial records
    UPDATE public.payouts 
    SET master_id = NULL
    WHERE master_id = user_profile_id;
    
    -- Handle refunds - don't delete for financial records
    UPDATE public.refunds 
    SET processed_by = NULL
    WHERE processed_by = user_profile_id;
    
    -- Handle courses - set instructor to NULL
    UPDATE public.courses 
    SET instructor_id = NULL
    WHERE instructor_id = user_profile_id;
    
    -- Handle services - set created_by to NULL
    UPDATE public.services 
    SET created_by = NULL
    WHERE created_by = user_profile_id;
    
    -- Finally, delete the profile itself
    DELETE FROM public.profiles 
    WHERE id = user_profile_id;
    
    RETURN OLD;
END;
$$;

-- ============================================
-- PART 2: Create trigger on auth.users
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_user_delete ON auth.users;

-- Create trigger that fires BEFORE DELETE on auth.users
CREATE TRIGGER on_user_delete
    BEFORE DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();

-- ============================================
-- PART 3: Also handle the case where profile exists but auth user doesn't
-- (orphaned profiles cleanup)
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete profiles that don't have corresponding auth.users
    DELETE FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = p.id
    );
END;
$$;

-- ============================================
-- NOTES:
-- ============================================
-- This migration fixes the "Failed to delete selected users" error by:
-- 1. Creating a trigger that automatically cleans up all related data
-- 2. Cascading deletes to tables with foreign key references
-- 3. Anonymizing references in financial tables (payments, payouts, refunds)
-- 4. Preserving appointment history by setting status to 'cancelled'
--
-- Now you can delete users from Supabase Auth dashboard without errors!
