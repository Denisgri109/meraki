-- Fix Stamp Card Schema & RPC
-- Created: 2026-02-08

-- ==========================================
-- 1. Ensure Tables Exist
-- ==========================================

-- Ensure client_stamps table exists
CREATE TABLE IF NOT EXISTS client_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
    master_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stamps_collected INTEGER DEFAULT 0,
    stamps_redeemed INTEGER DEFAULT 0,
    last_stamp_at TIMESTAMPTZ DEFAULT NOW(),
    last_redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, loyalty_card_id)
);

-- Ensure stamp_history table exists
CREATE TABLE IF NOT EXISTS stamp_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_stamp_id UUID NOT NULL REFERENCES client_stamps(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'earned', 'redeemed', 'manual_adjustment'
    stamps_change INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Add RLS Policies
-- ==========================================

-- Add RLS policies
ALTER TABLE client_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_history ENABLE ROW LEVEL SECURITY;

-- Policy for client_stamps: Clients can view their own stamps
DROP POLICY IF EXISTS "Clients can view their own stamps" ON client_stamps;
CREATE POLICY "Clients can view their own stamps" ON client_stamps
    FOR SELECT USING (auth.uid() = client_id);

-- Policy for client_stamps: Masters can view stamps for their cards
DROP POLICY IF EXISTS "Masters can view stamps for their cards" ON client_stamps;
CREATE POLICY "Masters can view stamps for their cards" ON client_stamps
    FOR SELECT USING (auth.uid() = master_id);

-- Policy for stamp_history: Clients can view their own history
DROP POLICY IF EXISTS "Clients can view their own stamp history" ON stamp_history;
CREATE POLICY "Clients can view their own stamp history" ON stamp_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM client_stamps
            WHERE client_stamps.id = stamp_history.client_stamp_id
            AND client_stamps.client_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON client_stamps TO authenticated;
GRANT ALL ON stamp_history TO authenticated;

-- ==========================================
-- 3. Fix RPC Type Mismatch
-- ==========================================

-- Explicitly cast columns to TEXT to match RETURNS TABLE definition

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
    lc.name::TEXT AS card_name,
    lc.description::TEXT AS card_description,
    p.id AS master_id,
    p.full_name::TEXT AS master_name,
    p.avatar_url::TEXT AS master_avatar,
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
