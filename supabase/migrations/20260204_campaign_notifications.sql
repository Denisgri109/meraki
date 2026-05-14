-- Campaign Notifications Enhancement Migration
-- Created: 2026-02-04
-- Purpose: Track sent campaign notifications to avoid duplicates

-- ============================================
-- 1. CAMPAIGN NOTIFICATIONS TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES aftercare_campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL, -- For aftercare campaigns
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate sends for the same campaign/client/appointment combo
  UNIQUE(campaign_id, client_id, COALESCE(appointment_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_campaign_notifications_campaign ON campaign_notifications_sent(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_notifications_client ON campaign_notifications_sent(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_notifications_sent_at ON campaign_notifications_sent(sent_at);

-- RLS for campaign_notifications_sent
ALTER TABLE campaign_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their campaign notification history"
  ON campaign_notifications_sent FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM aftercare_campaigns ac 
      WHERE ac.id = campaign_notifications_sent.campaign_id 
      AND ac.master_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view all campaign notifications"
  ON campaign_notifications_sent FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'owner'
    )
  );

-- ============================================
-- 2. ADD last_broadcast_at TO CAMPAIGNS
-- ============================================
-- Track when promotion/vacation/announcement was last broadcast

ALTER TABLE aftercare_campaigns 
ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ;

-- ============================================
-- 3. HELPER FUNCTION: Get master's clients
-- ============================================

CREATE OR REPLACE FUNCTION get_master_clients(p_master_id UUID)
RETURNS TABLE(
  client_id UUID,
  push_token TEXT,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    p.id as client_id,
    p.push_token,
    p.full_name
  FROM profiles p
  INNER JOIN appointments a ON a.client_id = p.id
  WHERE a.master_id = p_master_id
  AND p.push_token IS NOT NULL
  AND p.role = 'client';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
