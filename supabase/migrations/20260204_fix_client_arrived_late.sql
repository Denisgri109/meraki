-- Fix: client_arrived_late should mark appointment as 'completed' not 'confirmed'
-- This ensures the appointment is removed from the no-show/late view after the master
-- confirms the client has arrived late.

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
  
  -- Mark appointment as COMPLETED (not confirmed) so it moves out of the active view
  UPDATE appointments
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_appointment_id;
  
  RETURN QUERY SELECT true, 'Client marked as arrived (late). Appointment completed without no-show fee.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION client_arrived_late TO authenticated;
