-- Loyalty Stamp Card QR Scanning Migration
-- Created: 2026-02-04
-- Feature: Connect QR scanning to Master-specific stamp cards

-- ============================================
-- 1. RPC FUNCTION: Process Stamp QR Scan
-- ============================================

-- This function is called when a client scans a Master's stamp QR code
-- It looks up the Master's active loyalty card and adds a stamp

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
  VALUES (v_client_stamp_id, 'earned', 1, 'QR scan');
  
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

-- ============================================
-- 2. RPC FUNCTION: Get Client Stamp Cards
-- ============================================

-- Returns all stamp cards a client has progress on

CREATE OR REPLACE FUNCTION get_client_stamp_cards(p_client_id UUID)
RETURNS TABLE (
  stamp_id UUID,
  card_id UUID,
  card_name TEXT,
  card_description TEXT,
  master_id UUID,
  master_name TEXT,
  master_avatar TEXT,
  stamps_collected INTEGER,
  stamps_required INTEGER,
  stamps_redeemed INTEGER,
  reward_type TEXT,
  reward_value DECIMAL,
  reward_available BOOLEAN,
  last_stamp_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id AS stamp_id,
    lc.id AS card_id,
    lc.name AS card_name,
    lc.description AS card_description,
    p.id AS master_id,
    p.full_name AS master_name,
    p.avatar_url AS master_avatar,
    cs.stamps_collected,
    lc.stamps_required,
    cs.stamps_redeemed,
    lc.reward_type::TEXT,
    lc.reward_value,
    (cs.stamps_collected >= lc.stamps_required) AS reward_available,
    cs.last_stamp_at
  FROM client_stamps cs
  JOIN loyalty_cards lc ON cs.loyalty_card_id = lc.id
  JOIN profiles p ON lc.master_id = p.id
  WHERE cs.client_id = p_client_id
    AND lc.is_active = true
  ORDER BY cs.last_stamp_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_client_stamp_cards(UUID) TO authenticated;

-- ============================================
-- 3. RPC FUNCTION: Redeem Stamp Card Reward
-- ============================================

CREATE OR REPLACE FUNCTION redeem_stamp_card(
  p_client_stamp_id UUID,
  p_client_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_stamps_collected INTEGER;
  v_stamps_required INTEGER;
  v_card_name TEXT;
BEGIN
  -- Get current stamp status
  SELECT cs.stamps_collected, lc.stamps_required, lc.name
  INTO v_stamps_collected, v_stamps_required, v_card_name
  FROM client_stamps cs
  JOIN loyalty_cards lc ON cs.loyalty_card_id = lc.id
  WHERE cs.id = p_client_stamp_id
    AND cs.client_id = p_client_id;
  
  IF v_stamps_collected IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Stamp card not found'
    );
  END IF;
  
  IF v_stamps_collected < v_stamps_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('You need %s more stamps to redeem', v_stamps_required - v_stamps_collected)
    );
  END IF;
  
  -- Reset stamps and increment redemption count
  UPDATE client_stamps
  SET 
    stamps_collected = stamps_collected - v_stamps_required,
    stamps_redeemed = stamps_redeemed + 1,
    last_redeemed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_client_stamp_id;
  
  -- Record in history
  INSERT INTO stamp_history (client_stamp_id, action, stamps_change, notes)
  VALUES (p_client_stamp_id, 'redeemed', -v_stamps_required, 'Reward redeemed');
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Reward redeemed for %s! Show this to your Master.', v_card_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION redeem_stamp_card(UUID, UUID) TO authenticated;
