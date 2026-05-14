-- Global Master Platform & Photo Consultation Schema Updates
-- 20260202_global_features.sql

-- ============================================
-- 1. MASTER APPLICATION SYSTEM
-- ============================================

-- Table for master applications (self-registration with approval)
CREATE TABLE IF NOT EXISTS master_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  bio TEXT,
  
  -- Professional details
  years_of_experience INTEGER,
  specialties TEXT[], -- Array of specialty service IDs or names
  certifications TEXT[], -- Array of certification names/files
  portfolio_urls TEXT[], -- URLs to portfolio images
  
  -- Location & Service Area
  country_code VARCHAR(2) NOT NULL,
  city VARCHAR(255),
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  service_radius_km INTEGER, -- NULL means no limit (global), otherwise radius in km
  
  -- Currency & Pricing
  currency_code VARCHAR(3) NOT NULL DEFAULT 'EUR',
  
  -- Application status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  
  -- Review details
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  
  -- Linked profile (set when approved)
  profile_id UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status queries
CREATE INDEX idx_master_applications_status ON master_applications(status);
CREATE INDEX idx_master_applications_email ON master_applications(email);

-- RLS for master_applications
ALTER TABLE master_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for self-registration)
CREATE POLICY "Anyone can submit master application"
  ON master_applications FOR INSERT
  WITH CHECK (true);

-- Only owners can view/update all applications
CREATE POLICY "Owners can view all applications"
  ON master_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

CREATE POLICY "Owners can update applications"
  ON master_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- ============================================
-- 2. ENHANCED APPOINTMENT CONFIRMATIONS
-- ============================================

-- Add confirmation tracking to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ, -- When they must confirm by
ADD COLUMN IF NOT EXISTS client_confirmed BOOLEAN DEFAULT NULL, -- NULL = not sent, TRUE = confirmed, FALSE = declined
ADD COLUMN IF NOT EXISTS confirmation_reminder_count INTEGER DEFAULT 0;

-- ============================================
-- 3. PHOTO CONSULTATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS photo_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  master_id UUID REFERENCES profiles(id), -- Can be null for general/platform consultations
  
  -- Consultation details
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  service_type VARCHAR(255), -- What service they're interested in (lashes, brows, etc.)
  
  -- Photos
  photo_urls TEXT[] NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'responded', 'closed')),
  
  -- Professional assessment
  is_doable BOOLEAN, -- Can what they want be done?
  professional_notes TEXT, -- Master's professional advice
  recommendations TEXT, -- What master recommends
  estimated_price_range VARCHAR(255),
  estimated_duration VARCHAR(255),
  
  -- Response
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  
  -- Converted to booking?
  converted_to_booking BOOLEAN DEFAULT false,
  booking_id UUID REFERENCES appointments(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for photo_consultations
ALTER TABLE photo_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own consultations"
  ON photo_consultations FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can create consultations"
  ON photo_consultations FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Masters can view consultations assigned to them"
  ON photo_consultations FOR SELECT
  USING (master_id = auth.uid());

CREATE POLICY "Owners can view all consultations"
  ON photo_consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

CREATE POLICY "Masters and owners can update consultations"
  ON photo_consultations FOR UPDATE
  USING (
    master_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'owner' OR is_owner = true)
    )
  );

-- ============================================
-- 4. PROFILES ENHANCEMENTS FOR GLOBAL SUPPORT
-- ============================================

-- Add global marketplace fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS service_radius_km INTEGER, -- NULL = global
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
ADD COLUMN IF NOT EXISTS specialties TEXT[],
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_documents TEXT[], -- URLs to uploaded docs
ADD COLUMN IF NOT EXISTS stripe_connect_id VARCHAR(255); -- For payouts

-- ============================================
-- 5. PRODUCTS ENHANCEMENTS FOR INTERNATIONAL SHIPPING
-- ============================================

-- Add shipping-related fields to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS available_countries TEXT[] DEFAULT '{}', -- Empty array = all countries
ADD COLUMN IF NOT EXISTS restricted_countries TEXT[] DEFAULT '{}', -- Countries where not available
ADD COLUMN IF NOT EXISTS shipping_weight_kg DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false; -- For digital products like courses/certificates

-- ============================================
-- 6. ORDERS ENHANCEMENTS FOR INTERNATIONAL
-- ============================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2),
ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS customs_duties DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;

-- ============================================
-- 7. TRIGGER FOR UPDATING TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to new tables
CREATE TRIGGER update_master_applications_updated_at
    BEFORE UPDATE ON master_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photo_consultations_updated_at
    BEFORE UPDATE ON photo_consultations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
