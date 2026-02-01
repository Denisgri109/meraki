-- =====================================================
-- DATABASE HARD RESET SCRIPT
-- =====================================================
-- WARNING: This will DELETE ALL data from these tables!
-- Run in Supabase SQL Editor
-- =====================================================

BEGIN;

-- Step 1: Clear payment-related tables first (child tables)
DELETE FROM refunds;
DELETE FROM payouts;
DELETE FROM payments;

-- Step 2: Clear user credits that reference appointments
UPDATE user_credits SET appointment_id = NULL, is_used = false WHERE appointment_id IS NOT NULL;

-- Step 3: Clear the main business tables
DELETE FROM appointments;
DELETE FROM order_items;
DELETE FROM orders;

-- Step 4: Clear services
DELETE FROM master_services;
DELETE FROM services;

-- Step 5: Clear any blocked slots that might reference old data
DELETE FROM blocked_slots;

COMMIT;

-- =====================================================
-- VERIFICATION: Check tables are empty
-- =====================================================
SELECT 'appointments' as table_name, COUNT(*) as row_count FROM appointments
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

-- =====================================================
-- NOTES:
-- - profiles table is preserved (user accounts)
-- - conversations/messages are preserved
-- - master_availability is preserved
-- - This gives you a clean slate for appointments, orders, and services
-- =====================================================
