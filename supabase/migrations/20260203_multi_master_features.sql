-- Multi-Master Platform Features Migration
-- Created: 2026-02-03
-- Features: Master settings, confirmation timing, loyalty cards, T&C, consultations

-- ============================================
-- 1. MASTER SETTINGS TABLE (Per-Master Configuration)
-- ============================================

CREATE TABLE IF NOT EXISTS master_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Confirmation Settings
  confirmation_timing_hours INTEGER DEFAULT 24, -- 12, 24, or 72 hours before
  
  -- Cancellation Policy (configurable per master)
  cancellation_charge_percent INTEGER DEFAULT 50 CHECK (cancellation_charge_percent >= 0 AND cancellation_charge_percent <= 100),
  late_cancellation_window_hours INTEGER DEFAULT 24, -- Within how many hours is "late"
  no_show_charge_percent INTEGER DEFAULT 100,
  late_arrival_minutes INTEGER DEFAULT 15, -- After how many minutes is considered late
  
  -- Terms & Conditions
  terms_and_conditions TEXT, -- Rich text T&C
  terms_updated_at TIMESTAMPTZ,
  require_tc_acceptance BOOLEAN DEFAULT true,
  
  -- Business Settings
  accepts_new_clients BOOLEAN DEFAULT true,
  is_visible_globally BOOLEAN DEFAULT true, -- Show in global discovery
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(master_id)
);

-- Create index for fast lookup by master
CREATE INDEX IF NOT EXISTS idx_master_settings_master_id ON master_settings(master_id);

-- RLS for master_settings
ALTER TABLE master_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their own settings"
  ON master_settings FOR SELECT
  USING (master_id = auth.uid());

CREATE POLICY "Masters can update their own settings"
  ON master_settings FOR UPDATE
  USING (master_id = auth.uid());

CREATE POLICY "Masters can insert their own settings"
  ON master_settings FOR INSERT
  WITH CHECK (master_id = auth.uid());

CREATE POLICY "Owners can view all settings"
  ON master_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

CREATE POLICY "Clients can view master settings for booking"
  ON master_settings FOR SELECT
  USING (true); -- Allow clients to see T&C and cancellation policies

-- ============================================
-- 2. LOYALTY STAMP CARDS (Per-Master Virtual Cards)
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Card Info
  name VARCHAR(255) NOT NULL, -- e.g., "Brow Loyalty Card"
  description TEXT,
  service_category VARCHAR(255), -- Optional: limit to specific service category
  
  -- Stamp Rules
  stamps_required INTEGER NOT NULL DEFAULT 6, -- How many stamps for reward
  reward_type VARCHAR(50) NOT NULL DEFAULT 'free_service' CHECK (reward_type IN ('free_service', 'discount_percent', 'discount_amount')),
  reward_value DECIMAL(10,2), -- Discount amount or percentage, NULL for free_service
  
  -- Optional Constraints
  applicable_service_ids UUID[], -- NULL means all services
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client stamp progress
CREATE TABLE IF NOT EXISTS client_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  master_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Progress
  stamps_collected INTEGER DEFAULT 0,
  stamps_redeemed INTEGER DEFAULT 0, -- Track how many times redeemed
  
  -- Last activity
  last_stamp_at TIMESTAMPTZ,
  last_redeemed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, loyalty_card_id)
);

-- Stamp history for audit
CREATE TABLE IF NOT EXISTS stamp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_stamp_id UUID NOT NULL REFERENCES client_stamps(id) ON DELETE CASCADE,
  
  action VARCHAR(20) NOT NULL CHECK (action IN ('earned', 'redeemed', 'adjusted')),
  stamps_change INTEGER NOT NULL, -- Positive for earned, negative for redeemed
  
  -- Context
  appointment_id UUID REFERENCES appointments(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for loyalty tables
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_master_id ON loyalty_cards(master_id);
CREATE INDEX IF NOT EXISTS idx_client_stamps_client_id ON client_stamps(client_id);
CREATE INDEX IF NOT EXISTS idx_client_stamps_master_id ON client_stamps(master_id);
CREATE INDEX IF NOT EXISTS idx_stamp_history_client_stamp_id ON stamp_history(client_stamp_id);

-- RLS for loyalty tables
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_history ENABLE ROW LEVEL SECURITY;

-- Loyalty cards policies
CREATE POLICY "Anyone can view active loyalty cards"
  ON loyalty_cards FOR SELECT
  USING (is_active = true);

CREATE POLICY "Masters can manage their own cards"
  ON loyalty_cards FOR ALL
  USING (master_id = auth.uid());

CREATE POLICY "Owners can manage all cards"
  ON loyalty_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- Client stamps policies
CREATE POLICY "Clients can view their own stamps"
  ON client_stamps FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Masters can view and update stamps for their clients"
  ON client_stamps FOR ALL
  USING (master_id = auth.uid());

CREATE POLICY "Owners can manage all stamps"
  ON client_stamps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- Stamp history policies
CREATE POLICY "Clients can view their own stamp history"
  ON stamp_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_stamps 
      WHERE id = stamp_history.client_stamp_id 
      AND client_id = auth.uid()
    )
  );

CREATE POLICY "Masters can view stamp history for their cards"
  ON stamp_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_stamps cs
      WHERE cs.id = stamp_history.client_stamp_id 
      AND cs.master_id = auth.uid()
    )
  );

-- ============================================
-- 3. CONSULTATION REQUIREMENTS
-- ============================================

-- Add consultation flag to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS requires_consultation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consultation_questions JSONB; -- Array of questions to ask

-- Consultation questionnaire responses
CREATE TABLE IF NOT EXISTS consultation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  master_id UUID REFERENCES profiles(id),
  service_id UUID REFERENCES services(id),
  
  -- Questionnaire answers
  has_had_before BOOLEAN,
  time_since_last VARCHAR(100), -- "never", "less_than_6_months", "6_to_12_months", "over_1_year"
  was_with_this_master BOOLEAN,
  additional_answers JSONB, -- Any other questions answered
  
  -- Outcome
  consultation_required BOOLEAN DEFAULT false,
  consultation_completed BOOLEAN DEFAULT false,
  consultation_notes TEXT,
  
  -- Link to booking (if consultation leads to booking)
  appointment_id UUID REFERENCES appointments(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_responses_client ON consultation_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_consultation_responses_master ON consultation_responses(master_id);

ALTER TABLE consultation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view and create their own responses"
  ON consultation_responses FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Masters can view responses for their services"
  ON consultation_responses FOR SELECT
  USING (master_id = auth.uid());

CREATE POLICY "Owners can view all responses"
  ON consultation_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- ============================================
-- 4. T&C ACCEPTANCE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS tc_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  master_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Version tracking
  accepted_version_hash VARCHAR(64), -- Hash of the T&C text at acceptance time
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, master_id)
);

CREATE INDEX IF NOT EXISTS idx_tc_acceptances_client ON tc_acceptances(client_id);
CREATE INDEX IF NOT EXISTS idx_tc_acceptances_master ON tc_acceptances(master_id);

ALTER TABLE tc_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own acceptances"
  ON tc_acceptances FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can insert their own acceptances"
  ON tc_acceptances FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Masters can view acceptances for their T&C"
  ON tc_acceptances FOR SELECT
  USING (master_id = auth.uid());

-- ============================================
-- 5. AFTERCARE REMINDERS (Per-Master Campaigns)
-- ============================================

CREATE TABLE IF NOT EXISTS aftercare_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Campaign Info
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Type
  campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('aftercare', 'promotion', 'vacation', 'announcement')),
  
  -- Scheduling
  is_recurring BOOLEAN DEFAULT false,
  
  -- For one-time campaigns
  send_date DATE,
  
  -- For recurring campaigns
  days_after_appointment INTEGER, -- e.g., send 7 days after appointment
  service_category VARCHAR(255), -- Only for specific service appointments
  
  -- Date range (when campaign is active)
  start_date DATE,
  end_date DATE,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aftercare_campaigns_master ON aftercare_campaigns(master_id);

ALTER TABLE aftercare_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage their own campaigns"
  ON aftercare_campaigns FOR ALL
  USING (master_id = auth.uid());

CREATE POLICY "Owners can manage all campaigns"
  ON aftercare_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- ============================================
-- 6. SHIPPING REGIONS (Europe Only for Products)
-- ============================================

-- Add European countries list as a materialized view for validation
CREATE TABLE IF NOT EXISTS european_countries (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Insert European country codes
INSERT INTO european_countries (code, name) VALUES
  ('AT', 'Austria'), ('BE', 'Belgium'), ('BG', 'Bulgaria'), ('HR', 'Croatia'),
  ('CY', 'Cyprus'), ('CZ', 'Czech Republic'), ('DK', 'Denmark'), ('EE', 'Estonia'),
  ('FI', 'Finland'), ('FR', 'France'), ('DE', 'Germany'), ('GR', 'Greece'),
  ('HU', 'Hungary'), ('IE', 'Ireland'), ('IT', 'Italy'), ('LV', 'Latvia'),
  ('LT', 'Lithuania'), ('LU', 'Luxembourg'), ('MT', 'Malta'), ('NL', 'Netherlands'),
  ('PL', 'Poland'), ('PT', 'Portugal'), ('RO', 'Romania'), ('SK', 'Slovakia'),
  ('SI', 'Slovenia'), ('ES', 'Spain'), ('SE', 'Sweden'),
  -- Additional European countries (non-EU)
  ('GB', 'United Kingdom'), ('CH', 'Switzerland'), ('NO', 'Norway'), ('IS', 'Iceland'),
  ('LI', 'Liechtenstein'), ('AL', 'Albania'), ('AD', 'Andorra'), ('BA', 'Bosnia and Herzegovina'),
  ('ME', 'Montenegro'), ('MK', 'North Macedonia'), ('RS', 'Serbia'), ('UA', 'Ukraine'),
  ('MD', 'Moldova'), ('MC', 'Monaco'), ('SM', 'San Marino'), ('VA', 'Vatican City')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 7. FUNCTION: Create default settings for new masters
-- ============================================

CREATE OR REPLACE FUNCTION create_default_master_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- When profile is updated to master role, create default settings
  IF NEW.role = 'master' AND (OLD.role IS NULL OR OLD.role != 'master') THEN
    INSERT INTO master_settings (master_id)
    VALUES (NEW.id)
    ON CONFLICT (master_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creating settings
DROP TRIGGER IF EXISTS trigger_create_master_settings ON profiles;
CREATE TRIGGER trigger_create_master_settings
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_master_settings();

-- ============================================
-- 8. FUNCTION: Add stamp to client card
-- ============================================

CREATE OR REPLACE FUNCTION add_loyalty_stamp(
  p_client_id UUID,
  p_loyalty_card_id UUID,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_total INTEGER, reward_available BOOLEAN, message TEXT) AS $$
DECLARE
  v_master_id UUID;
  v_stamps_required INTEGER;
  v_current_stamps INTEGER;
  v_client_stamp_id UUID;
BEGIN
  -- Get card info
  SELECT master_id, stamps_required INTO v_master_id, v_stamps_required
  FROM loyalty_cards 
  WHERE id = p_loyalty_card_id AND is_active = true;
  
  IF v_master_id IS NULL THEN
    RETURN QUERY SELECT false, 0, false, 'Loyalty card not found or inactive'::TEXT;
    RETURN;
  END IF;
  
  -- Get or create client stamp record
  INSERT INTO client_stamps (client_id, loyalty_card_id, master_id, stamps_collected, last_stamp_at)
  VALUES (p_client_id, p_loyalty_card_id, v_master_id, 1, NOW())
  ON CONFLICT (client_id, loyalty_card_id) 
  DO UPDATE SET 
    stamps_collected = client_stamps.stamps_collected + 1,
    last_stamp_at = NOW(),
    updated_at = NOW()
  RETURNING id, stamps_collected INTO v_client_stamp_id, v_current_stamps;
  
  -- Record in history
  INSERT INTO stamp_history (client_stamp_id, action, stamps_change, appointment_id)
  VALUES (v_client_stamp_id, 'earned', 1, p_appointment_id);
  
  -- Check if reward available
  RETURN QUERY SELECT 
    true, 
    v_current_stamps, 
    (v_current_stamps >= v_stamps_required),
    CASE 
      WHEN v_current_stamps >= v_stamps_required THEN 'Congratulations! You earned a reward!'
      ELSE format('Stamp added! %s/%s stamps collected', v_current_stamps, v_stamps_required)
    END::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. UPDATE TIMESTAMP TRIGGERS
-- ============================================

CREATE TRIGGER update_master_settings_updated_at
    BEFORE UPDATE ON master_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_cards_updated_at
    BEFORE UPDATE ON loyalty_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_stamps_updated_at
    BEFORE UPDATE ON client_stamps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_responses_updated_at
    BEFORE UPDATE ON consultation_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aftercare_campaigns_updated_at
    BEFORE UPDATE ON aftercare_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES:
-- ============================================
-- This migration adds:
-- 1. master_settings: Per-master configuration (confirmation timing, cancellation %, T&C)
-- 2. loyalty_cards: Virtual stamp cards per master
-- 3. client_stamps: Track client progress on cards
-- 4. stamp_history: Audit trail for stamps
-- 5. consultation_responses: Track consultation questionnaires
-- 6. tc_acceptances: Track T&C acceptance per client/master
-- 7. aftercare_campaigns: Custom reminder campaigns per master
-- 8. european_countries: Reference table for shipping validation
