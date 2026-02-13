-- Stamp Card Per-Appointment Cooldown Migration
-- Created: 2026-02-08
-- Feature: Enforce 1 stamp per completed appointment validation

-- ============================================
-- 1. Update process_stamp_scan RPC with cooldown
-- ============================================

CREATE OR REPLACE FUNCTION process_stamp_scan(
  p_master_id UUID,
  p_client_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_card_id UUID;
  v_card_name TEXT;
  v_stamps_required INTEGER;
  v_master_name TEXT;
  v_client_stamp_id UUID;
  v_current_stamps INTEGER;
  v_reward_available BOOLEAN;
  v_reward_type TEXT;
  v_reward_value DECIMAL;
  v_unstamped_appointment_id UUID;
  v_last_stamp_at TIMESTAMPTZ;
  v_completed_appointment_count INTEGER;
  v_stamp_count_since_last_appointment INTEGER;
BEGIN
  -- Get the Master's active loyalty card (first one if multiple)
  SELECT id, name, stamps_required, reward_type, reward_value 
  INTO v_card_id, v_card_name, v_stamps_required, v_reward_type, v_reward_value
  FROM loyalty_cards 
  WHERE master_id = p_master_id 
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no active card found
  IF v_card_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This Master has no active loyalty card'
    );
  END IF;
  
  -- Get master name
  SELECT full_name INTO v_master_name
  FROM profiles
  WHERE id = p_master_id;
  
  -- Prevent client scanning their own code if they're also a master
  IF p_master_id = p_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You cannot scan your own QR code'
    );
  END IF;
  
  -- Get the last stamp time for this client-master pair
  SELECT cs.last_stamp_at INTO v_last_stamp_at
  FROM client_stamps cs
  WHERE cs.client_id = p_client_id 
    AND cs.loyalty_card_id = v_card_id;
  
  -- Count completed appointments with this master since last stamp
  -- An appointment is "stampable" if it was completed after the last stamp
  SELECT COUNT(*) INTO v_completed_appointment_count
  FROM appointments a
  WHERE a.client_id = p_client_id
    AND a.master_id = p_master_id
    AND a.status = 'completed'
    AND (v_last_stamp_at IS NULL OR a.updated_at > v_last_stamp_at);
  
  -- If no new completed appointments, deny the stamp
  IF v_completed_appointment_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No new completed appointments to stamp. Complete an appointment first!'
    );
  END IF;
  
  -- Count stamps collected since the earliest unstamped appointment
  -- This prevents multiple stamps per appointment
  SELECT COUNT(*) INTO v_stamp_count_since_last_appointment
  FROM stamp_history sh
  JOIN client_stamps cs ON sh.client_stamp_id = cs.id
  WHERE cs.client_id = p_client_id
    AND cs.loyalty_card_id = v_card_id
    AND sh.action = 'earned'
    AND sh.created_at > COALESCE(v_last_stamp_at, '1970-01-01'::TIMESTAMPTZ);
  
  -- If stamps already equal or exceed completed appointments, deny
  IF v_stamp_count_since_last_appointment >= v_completed_appointment_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You have already collected stamps for all completed appointments'
    );
  END IF;
  
  -- Get or create client stamp record
  INSERT INTO client_stamps (client_id, loyalty_card_id, master_id, stamps_collected, last_stamp_at)
  VALUES (p_client_id, v_card_id, p_master_id, 1, NOW())
  ON CONFLICT (client_id, loyalty_card_id) 
  DO UPDATE SET 
    stamps_collected = client_stamps.stamps_collected + 1,
    last_stamp_at = NOW(),
    updated_at = NOW()
  RETURNING id, stamps_collected INTO v_client_stamp_id, v_current_stamps;
  
  -- Record in history
  INSERT INTO stamp_history (client_stamp_id, action, stamps_change, notes)
  VALUES (v_client_stamp_id, 'earned', 1, 'QR/NFC scan');
  
  -- Check if reward available
  v_reward_available := v_current_stamps >= v_stamps_required;
  
  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'master_name', v_master_name,
    'card_name', v_card_name,
    'stamps_collected', v_current_stamps,
    'stamps_required', v_stamps_required,
    'reward_available', v_reward_available,
    'reward_type', v_reward_type,
    'reward_value', v_reward_value,
    'message', CASE 
      WHEN v_reward_available THEN 'Congratulations! You earned a reward!'
      ELSE format('Stamp added! %s/%s stamps collected', v_current_stamps, v_stamps_required)
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_stamp_scan(UUID, UUID) TO authenticated;
