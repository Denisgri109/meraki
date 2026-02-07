-- =============================================
-- MANDATORY DEPOSIT SYSTEM
-- =============================================
-- Implements upfront deposit collection for bookings
-- Replaces manual no-show charging logic
-- =============================================

-- Add deposit configuration to master_settings
ALTER TABLE master_settings
ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('fixed', 'percentage')) DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 100 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100);

-- Add deposit tracking to appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deposit_payment_intent_id TEXT;

-- Create function to get master deposit settings
CREATE OR REPLACE FUNCTION get_master_deposit_settings(p_master_id UUID)
RETURNS TABLE (
    deposit_type TEXT,
    deposit_amount DECIMAL,
    deposit_percentage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ms.deposit_type, 'percentage') as deposit_type,
        COALESCE(ms.deposit_amount, 0) as deposit_amount,
        COALESCE(ms.deposit_percentage, 100) as deposit_percentage
    FROM master_settings ms
    WHERE ms.master_id = p_master_id;
    
    -- If no settings exist, return defaults
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            'percentage'::TEXT as deposit_type,
            0::DECIMAL as deposit_amount,
            100::INTEGER as deposit_percentage;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update book_appointment_with_confirmation to include deposit info
CREATE OR REPLACE FUNCTION book_appointment_with_confirmation(
    p_master_id UUID,
    p_service_id UUID,
    p_start_time TIMESTAMPTZ,
    p_stripe_setup_intent_id TEXT DEFAULT NULL,
    p_stripe_payment_intent_id TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_deposit_amount DECIMAL DEFAULT 0,
    p_deposit_payment_intent_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
    v_service RECORD;
    v_appointment_id UUID;
    v_end_time TIMESTAMPTZ;
BEGIN
    -- Get current user
    v_client_id := auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get service details
    SELECT * INTO v_service FROM services WHERE id = p_service_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    -- Calculate end time
    v_end_time := p_start_time + (v_service.duration_minutes || ' minutes')::INTERVAL;

    -- Create appointment with deposit info
    INSERT INTO appointments (
        master_id,
        client_id,
        service_id,
        start_time,
        end_time,
        price,
        status,
        notes,
        stripe_setup_intent_id,
        stripe_payment_intent_id,
        deposit_amount,
        deposit_paid,
        deposit_payment_intent_id
    ) VALUES (
        p_master_id,
        v_client_id,
        p_service_id,
        p_start_time,
        v_end_time,
        v_service.base_price,
        'confirmed',
        p_notes,
        p_stripe_setup_intent_id,
        p_stripe_payment_intent_id,
        p_deposit_amount,
        CASE WHEN p_deposit_amount > 0 THEN TRUE ELSE FALSE END,
        p_deposit_payment_intent_id
    )
    RETURNING id INTO v_appointment_id;

    -- Create confirmation record
    INSERT INTO appointment_confirmations (
        appointment_id,
        confirmed,
        confirmed_at
    ) VALUES (
        v_appointment_id,
        TRUE,
        NOW()
    );

    RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_master_deposit_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION book_appointment_with_confirmation(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, DECIMAL, TEXT) TO authenticated;
