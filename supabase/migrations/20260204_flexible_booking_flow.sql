-- Flexible Booking & No-Show Flow Migration
-- Created: 2026-02-04
-- Features: Confirmation flow, auto-cancel, no-show protection, email notifications

-- ============================================
-- 1. UPDATE APPOINTMENT STATUS ENUM
-- ============================================

-- Add 'awaiting_confirmation' status (this requires recreating the enum)
-- First, create a new enum type
CREATE TYPE appointment_status_new AS ENUM (
  'awaiting_confirmation',
  'pending',
  'confirmed', 
  'completed',
  'cancelled',
  'no_show'
);

-- Update the column to use the new enum (PostgreSQL requires this approach)
-- Note: In production, you might need to handle data migration more carefully
ALTER TABLE appointments 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE appointment_status_new USING status::text::appointment_status_new,
  ALTER COLUMN status SET DEFAULT 'awaiting_confirmation';

-- Drop old enum and rename new one
DROP TYPE appointment_status;
ALTER TYPE appointment_status_new RENAME TO appointment_status;

-- ============================================
-- 2. EXTEND APPOINTMENTS TABLE
-- ============================================

ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirmation_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_cancel_scheduled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_hold_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS no_show_charge_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS no_show_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_duration_minutes INTEGER; -- Store duration for grace period calc

-- Add trigger to update status_updated_at
CREATE OR REPLACE FUNCTION update_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_status_update ON appointments;
CREATE TRIGGER trigger_status_update
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- ============================================
-- 3. EXTEND APPOINTMENT_CONFIRMATIONS TABLE
-- ============================================

ALTER TABLE appointment_confirmations
  ADD COLUMN IF NOT EXISTS response_type VARCHAR(20) CHECK (response_type IN ('yes', 'no', 'timeout')),
  ADD COLUMN IF NOT EXISTS no_show_charge_captured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_charge_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS master_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_arrived_late BOOLEAN DEFAULT false;

-- ============================================
-- 4. ADD EMAIL NOTIFICATION LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'confirmation_request', 'confirmation_yes', 'confirmation_no', 'no_show_charge', 'auto_cancel', 'late_reminder'
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('push', 'email', 'sms')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_appointment ON notification_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notification_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notification_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. UPDATE MASTER_SETTINGS TABLE
-- ============================================

-- Add response timeout settings if not exists
ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS confirmation_response_timeout_hours INTEGER DEFAULT 24 CHECK (confirmation_response_timeout_hours > 0 AND confirmation_response_timeout_hours <= 72),
  ADD COLUMN IF NOT EXISTS auto_charge_after_grace_period BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS grace_period_multiplier DECIMAL(3,2) DEFAULT 0.5; -- 0.5 = half of appointment duration

-- ============================================
-- 6. FUNCTION: Calculate confirmation deadline
-- ============================================

CREATE OR REPLACE FUNCTION calculate_confirmation_deadline(
  p_appointment_time TIMESTAMPTZ,
  p_confirmation_timing_hours INTEGER,
  p_response_timeout_hours INTEGER DEFAULT 24
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_reminder_time TIMESTAMPTZ;
  v_deadline TIMESTAMPTZ;
BEGIN
  -- When to send reminder: appointment_time - confirmation_timing_hours
  v_reminder_time := p_appointment_time - (p_confirmation_timing_hours || ' hours')::INTERVAL;
  
  -- Deadline for response: reminder_time + response_timeout_hours
  v_deadline := v_reminder_time + (p_response_timeout_hours || ' hours')::INTERVAL;
  
  -- Ensure deadline is not after appointment time
  IF v_deadline > p_appointment_time THEN
    v_deadline := p_appointment_time - INTERVAL '1 hour';
  END IF;
  
  RETURN v_deadline;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION: Calculate grace period
-- ============================================

CREATE OR REPLACE FUNCTION calculate_grace_period(
  p_service_duration_minutes INTEGER,
  p_grace_period_multiplier DECIMAL(3,2) DEFAULT 0.5
)
RETURNS INTEGER AS $$
BEGIN
  -- Return half of the appointment duration in minutes
  RETURN GREATEST(15, CEIL(p_service_duration_minutes * p_grace_period_multiplier)::INTEGER);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. FUNCTION: Book appointment with confirmation flow
-- ============================================

CREATE OR REPLACE FUNCTION book_appointment_with_confirmation(
  p_master_id UUID,
  p_service_id UUID,
  p_start_time TIMESTAMPTZ,
  p_stripe_setup_intent_id TEXT,
  p_stripe_payment_intent_id TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_appointment_id UUID;
  v_service_duration INTEGER;
  v_service_price DECIMAL(10,2);
  v_master_settings RECORD;
  v_confirmation_deadline TIMESTAMPTZ;
  v_client_id UUID;
BEGIN
  -- Get current user (client)
  v_client_id := auth.uid();
  
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Get service details
  SELECT duration_minutes, base_price 
  INTO v_service_duration, v_service_price
  FROM services 
  WHERE id = p_service_id;
  
  IF v_service_duration IS NULL THEN
    RAISE EXCEPTION 'Service not found';
  END IF;
  
  -- Get master settings
  SELECT confirmation_timing_hours, confirmation_response_timeout_hours
  INTO v_master_settings
  FROM master_settings
  WHERE master_id = p_master_id;
  
  -- Use defaults if no settings found
  IF v_master_settings.confirmation_timing_hours IS NULL THEN
    v_master_settings.confirmation_timing_hours := 24;
  END IF;
  IF v_master_settings.confirmation_response_timeout_hours IS NULL THEN
    v_master_settings.confirmation_response_timeout_hours := 24;
  END IF;
  
  -- Calculate confirmation deadline
  v_confirmation_deadline := calculate_confirmation_deadline(
    p_start_time,
    v_master_settings.confirmation_timing_hours,
    v_master_settings.confirmation_response_timeout_hours
  );
  
  -- Create appointment
  INSERT INTO appointments (
    client_id,
    master_id,
    service_id,
    start_time,
    end_time,
    price,
    notes,
    status,
    stripe_setup_intent_id,
    stripe_payment_intent_id,
    confirmation_deadline,
    payment_hold_amount,
    service_duration_minutes,
    requires_confirmation,
    status_updated_at
  ) VALUES (
    v_client_id,
    p_master_id,
    p_service_id,
    p_start_time,
    p_start_time + (v_service_duration || ' minutes')::INTERVAL,
    v_service_price,
    p_notes,
    'awaiting_confirmation',
    p_stripe_setup_intent_id,
    p_stripe_payment_intent_id,
    v_confirmation_deadline,
    v_service_price,
    v_service_duration,
    true,
    NOW()
  )
  RETURNING id INTO v_appointment_id;
  
  -- Create confirmation record
  INSERT INTO appointment_confirmations (
    appointment_id,
    confirmed,
    created_at
  ) VALUES (
    v_appointment_id,
    NULL,
    NOW()
  );
  
  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCTION: Client confirm appointment
-- ============================================

CREATE OR REPLACE FUNCTION client_confirm_appointment(
  p_appointment_id UUID,
  p_response VARCHAR(20) -- 'yes' or 'no'
)
RETURNS TABLE(
  success BOOLEAN,
  new_status TEXT,
  message TEXT
) AS $$
DECLARE
  v_appointment RECORD;
  v_client_id UUID;
BEGIN
  v_client_id := auth.uid();
  
  -- Get appointment details
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id AND client_id = v_client_id;
  
  IF v_appointment IS NULL THEN
    RETURN QUERY SELECT false, 'error', 'Appointment not found or access denied'::TEXT;
    RETURN;
  END IF;
  
  IF v_appointment.status != 'awaiting_confirmation' THEN
    RETURN QUERY SELECT false, v_appointment.status::TEXT, 'Appointment is not awaiting confirmation'::TEXT;
    RETURN;
  END IF;
  
  IF p_response = 'yes' THEN
    -- Update appointment to confirmed
    UPDATE appointments
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_appointment_id;
    
    -- Update confirmation record
    UPDATE appointment_confirmations
    SET confirmed = true,
        confirmed_at = NOW(),
        responded_at = NOW(),
        response_type = 'yes',
        updated_at = NOW()
    WHERE appointment_id = p_appointment_id;
    
    RETURN QUERY SELECT true, 'confirmed', 'Appointment confirmed successfully. We look forward to seeing you!'::TEXT;
    
  ELSIF p_response = 'no' THEN
    -- Cancel the appointment and release payment hold
    UPDATE appointments
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_appointment_id;
    
    -- Update confirmation record
    UPDATE appointment_confirmations
    SET confirmed = false,
        responded_at = NOW(),
        response_type = 'no',
        updated_at = NOW()
    WHERE appointment_id = p_appointment_id;
    
    -- Note: PaymentIntent cancellation should be handled by edge function
    
    RETURN QUERY SELECT true, 'cancelled', 'Appointment cancelled. The time slot is now available for others.'::TEXT;
    
  ELSE
    RETURN QUERY SELECT false, v_appointment.status::TEXT, 'Invalid response. Use yes or no.'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCTION: Process no-show charge
-- ============================================

CREATE OR REPLACE FUNCTION process_no_show_charge(
  p_appointment_id UUID,
  p_charge_now BOOLEAN DEFAULT true
)
RETURNS TABLE(
  success BOOLEAN,
  charge_amount DECIMAL(10,2),
  grace_period_minutes INTEGER,
  grace_period_ends_at TIMESTAMPTZ,
  message TEXT
) AS $$
DECLARE
  v_appointment RECORD;
  v_master_settings RECORD;
  v_charge_amount DECIMAL(10,2);
  v_grace_period_minutes INTEGER;
  v_grace_period_ends TIMESTAMPTZ;
  v_master_id UUID;
BEGIN
  v_master_id := auth.uid();
  
  -- Get appointment
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id AND master_id = v_master_id;
  
  IF v_appointment IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL, 0, NULL::TIMESTAMPTZ, 'Appointment not found or access denied'::TEXT;
    RETURN;
  END IF;
  
  -- Get master settings
  SELECT no_show_charge_percent, grace_period_multiplier, auto_charge_after_grace_period
  INTO v_master_settings
  FROM master_settings
  WHERE master_id = v_master_id;
  
  IF v_master_settings.no_show_charge_percent IS NULL THEN
    v_master_settings.no_show_charge_percent := 100;
  END IF;
  IF v_master_settings.grace_period_multiplier IS NULL THEN
    v_master_settings.grace_period_multiplier := 0.5;
  END IF;
  
  -- Calculate grace period
  v_grace_period_minutes := calculate_grace_period(
    COALESCE(v_appointment.service_duration_minutes, 60),
    v_master_settings.grace_period_multiplier
  );
  
  v_grace_period_ends := NOW() + (v_grace_period_minutes || ' minutes')::INTERVAL;
  
  -- Calculate charge amount
  v_charge_amount := (v_appointment.price * v_master_settings.no_show_charge_percent / 100);
  
  IF p_charge_now THEN
    -- Mark for immediate charging
    UPDATE appointments
    SET status = 'no_show',
        no_show_charge_amount = v_charge_amount,
        no_show_processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_appointment_id;
    
    UPDATE appointment_confirmations
    SET no_show_charge_captured = true,
        grace_period_ends_at = v_grace_period_ends,
        updated_at = NOW()
    WHERE appointment_id = p_appointment_id;
    
    RETURN QUERY SELECT true, v_charge_amount, v_grace_period_minutes, v_grace_period_ends, 
      format('No-show charge of %s%% (%s) will be processed immediately', 
        v_master_settings.no_show_charge_percent, v_charge_amount)::TEXT;
  ELSE
    -- Set grace period - will auto-charge after unless client arrives
    UPDATE appointment_confirmations
    SET grace_period_ends_at = v_grace_period_ends,
        updated_at = NOW()
    WHERE appointment_id = p_appointment_id;
    
    RETURN QUERY SELECT true, v_charge_amount, v_grace_period_minutes, v_grace_period_ends,
      format('Grace period set for %s minutes. Client can still arrive. Auto-charge at: %s', 
        v_grace_period_minutes, v_grace_period_ends)::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. FUNCTION: Client arrived late (no charge)
-- ============================================

CREATE OR REPLACE FUNCTION client_arrived_late(
  p_appointment_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_master_id UUID;
BEGIN
  v_master_id := auth.uid();
  
  -- Verify master owns this appointment
  IF NOT EXISTS (
    SELECT 1 FROM appointments 
    WHERE id = p_appointment_id AND master_id = v_master_id
  ) THEN
    RETURN QUERY SELECT false, 'Appointment not found or access denied'::TEXT;
    RETURN;
  END IF;
  
  -- Mark as arrived late, no charge
  UPDATE appointment_confirmations
  SET client_arrived_at = NOW(),
      client_arrived_late = true,
      grace_period_ends_at = NULL, -- Cancel any pending auto-charge
      updated_at = NOW()
  WHERE appointment_id = p_appointment_id;
  
  -- Keep appointment as confirmed, can be completed normally
  UPDATE appointments
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = p_appointment_id;
  
  RETURN QUERY SELECT true, 'Client marked as arrived (late). No no-show fee applied.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. FUNCTION: Get appointments needing confirmation reminder
-- ============================================

CREATE OR REPLACE FUNCTION get_appointments_needing_confirmation_reminder()
RETURNS TABLE(
  appointment_id UUID,
  client_id UUID,
  master_id UUID,
  start_time TIMESTAMPTZ,
  confirmation_deadline TIMESTAMPTZ,
  master_full_name TEXT,
  client_email TEXT,
  client_push_token TEXT,
  service_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as appointment_id,
    a.client_id,
    a.master_id,
    a.start_time,
    a.confirmation_deadline,
    p.full_name as master_full_name,
    p_client.email as client_email,
    p_client.push_token as client_push_token,
    s.name as service_name
  FROM appointments a
  JOIN profiles p ON a.master_id = p.id
  JOIN profiles p_client ON a.client_id = p_client.id
  JOIN services s ON a.service_id = s.id
  LEFT JOIN appointment_confirmations ac ON a.id = ac.appointment_id
  WHERE a.status = 'awaiting_confirmation'
    AND a.confirmation_reminder_sent_at IS NULL
    AND a.start_time > NOW()
    AND a.confirmation_deadline > NOW()
    -- Only send reminder if we're within the confirmation timing window
    AND a.start_time - (SELECT confirmation_timing_hours FROM master_settings WHERE master_id = a.master_id) * INTERVAL '1 hour' <= NOW() + INTERVAL '5 minutes'
    AND a.start_time - (SELECT confirmation_timing_hours FROM master_settings WHERE master_id = a.master_id) * INTERVAL '1 hour' > NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. FUNCTION: Get appointments for auto-cancel
-- ============================================

CREATE OR REPLACE FUNCTION get_appointments_for_auto_cancel()
RETURNS TABLE(
  appointment_id UUID,
  client_id UUID,
  master_id UUID,
  stripe_payment_intent_id TEXT,
  client_email TEXT,
  master_email TEXT,
  service_name TEXT,
  start_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as appointment_id,
    a.client_id,
    a.master_id,
    a.stripe_payment_intent_id,
    p_client.email as client_email,
    p_master.email as master_email,
    s.name as service_name,
    a.start_time
  FROM appointments a
  JOIN profiles p_client ON a.client_id = p_client.id
  JOIN profiles p_master ON a.master_id = p_master.id
  JOIN services s ON a.service_id = s.id
  LEFT JOIN appointment_confirmations ac ON a.id = ac.appointment_id
  WHERE a.status = 'awaiting_confirmation'
    AND a.confirmation_deadline < NOW()
    AND ac.confirmed IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. FUNCTION: Auto-cancel appointment
-- ============================================

CREATE OR REPLACE FUNCTION auto_cancel_appointment(
  p_appointment_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  -- Cancel the appointment
  UPDATE appointments
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_appointment_id AND status = 'awaiting_confirmation';
  
  -- Update confirmation record
  UPDATE appointment_confirmations
  SET confirmed = false,
      response_type = 'timeout',
      responded_at = NOW(),
      updated_at = NOW()
  WHERE appointment_id = p_appointment_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Appointment auto-cancelled due to no response'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Appointment not found or already processed'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 15. FUNCTION: Get appointments ready for auto-charge (grace period expired)
-- ============================================

CREATE OR REPLACE FUNCTION get_appointments_for_auto_charge()
RETURNS TABLE(
  appointment_id UUID,
  client_id UUID,
  master_id UUID,
  no_show_charge_amount DECIMAL(10,2),
  stripe_payment_intent_id TEXT,
  client_email TEXT,
  master_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as appointment_id,
    a.client_id,
    a.master_id,
    a.no_show_charge_amount,
    a.stripe_payment_intent_id,
    p_client.email as client_email,
    p_master.email as master_email
  FROM appointments a
  JOIN appointment_confirmations ac ON a.id = ac.appointment_id
  JOIN profiles p_client ON a.client_id = p_client.id
  JOIN profiles p_master ON a.master_id = p_master.id
  JOIN master_settings ms ON a.master_id = ms.master_id
  WHERE a.status = 'confirmed'
    AND ac.grace_period_ends_at < NOW()
    AND ac.no_show_charge_captured = false
    AND ms.auto_charge_after_grace_period = true
    AND a.no_show_processed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 16. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_deadline ON appointments(confirmation_deadline) WHERE status = 'awaiting_confirmation';
CREATE INDEX IF NOT EXISTS idx_appointments_status_updated ON appointments(status, status_updated_at);
CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_response ON appointment_confirmations(confirmed, responded_at);
CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_grace_period ON appointment_confirmations(grace_period_ends_at, no_show_charge_captured) WHERE grace_period_ends_at IS NOT NULL;

-- ============================================
-- NOTES:
-- ============================================
-- This migration implements the Flexible Booking & No-Show Flow:
-- 1. New 'awaiting_confirmation' status for appointments
-- 2. Confirmation deadline calculation (24h response window)
-- 3. Grace period = 0.5 × appointment duration for no-show decisions
-- 4. Functions for booking, confirmation, auto-cancel, and no-show processing
-- 5. Email notification logging table
-- 6. Performance indexes for cron jobs
-- 
-- REQUIRED FOLLOW-UP:
-- - Deploy Edge Functions for:
--   * send-confirmation-reminder (cron job every 15 mins)
--   * auto-cancel-no-response (cron job every 15 mins)
--   * process-no-show-charge (called by master or cron)
--   * email notifications via SendGrid/Resend
--   * Stripe PaymentIntent operations
-- 
-- - Client UI: Confirmation response screen
-- - Master UI: No-show/late action button
-- - Cron job configuration in Supabase dashboard
