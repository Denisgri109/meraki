-- Add columns for time-window cancellation policy
-- This migration adds fields to track cancellation fees and reasons

-- Add cancellation fee amount (in cents) for late cancellations
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS cancellation_fee_amount INTEGER DEFAULT 0;

-- Add cancellation reason field
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Note: The status field already uses text type, so these additional values
-- are handled at the application level:
-- 'confirmed' - Standard upcoming appointment
-- 'cancelled_free' - Client canceled early (>24h), no charge
-- 'cancelled_charge' - Client canceled late (<24h), penalty taken
-- 'reschedule_pending' - Late reschedule awaiting Master approval
-- 'completed' - Service finished
-- 'no_show' - Client absent, full charge triggered

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

COMMENT ON COLUMN appointments.cancellation_fee_amount IS 'Fee charged for late cancellation in cents';
COMMENT ON COLUMN appointments.cancellation_reason IS 'Reason provided by client for cancellation';
