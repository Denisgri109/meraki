-- Create booking_consultations table for pre-booking approval workflow
-- This is separate from photo_consultations which is for general consultations

-- Create status enum for booking consultations
DO $$ BEGIN
    CREATE TYPE booking_consultation_status AS ENUM (
        'pending',
        'approved',
        'declined',
        'chat_requested'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the booking_consultations table
CREATE TABLE IF NOT EXISTS booking_consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    master_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Questionnaire responses
    had_before BOOLEAN NOT NULL DEFAULT false,
    how_long_ago TEXT, -- '1-3 months', '3-6 months', '6-12 months', '1+ years'
    was_my_work BOOLEAN,
    photo_urls TEXT[] DEFAULT '{}',
    additional_notes TEXT,
    
    -- Status and approval
    status booking_consultation_status NOT NULL DEFAULT 'pending',
    booking_link_token UUID DEFAULT gen_random_uuid(),
    approval_expires_at TIMESTAMPTZ,
    
    -- Master response
    master_notes TEXT,
    responded_at TIMESTAMPTZ,
    
    -- Tracking
    converted_to_booking BOOLEAN DEFAULT false,
    booking_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add requires_consultation flag to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS requires_consultation BOOLEAN DEFAULT false;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_booking_consultations_client_id 
ON booking_consultations(client_id);

CREATE INDEX IF NOT EXISTS idx_booking_consultations_master_id 
ON booking_consultations(master_id);

CREATE INDEX IF NOT EXISTS idx_booking_consultations_service_id 
ON booking_consultations(service_id);

CREATE INDEX IF NOT EXISTS idx_booking_consultations_status 
ON booking_consultations(status);

CREATE INDEX IF NOT EXISTS idx_booking_consultations_token 
ON booking_consultations(booking_link_token);

-- Enable RLS
ALTER TABLE booking_consultations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Clients can view their own consultations
CREATE POLICY "Clients can view own consultations"
ON booking_consultations FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

-- Clients can insert their own consultations
CREATE POLICY "Clients can create consultations"
ON booking_consultations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Masters can view consultations assigned to them or unassigned for their services
CREATE POLICY "Masters can view relevant consultations"
ON booking_consultations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (role = 'master' OR role = 'owner')
    )
    AND (
        master_id = auth.uid() 
        OR master_id IS NULL
        OR EXISTS (
            SELECT 1 FROM master_services ms
            WHERE ms.master_id = auth.uid()
            AND ms.service_id = booking_consultations.service_id
        )
    )
);

-- Masters can update consultations they're reviewing
CREATE POLICY "Masters can update consultations"
ON booking_consultations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (role = 'master' OR role = 'owner')
    )
    AND (
        master_id = auth.uid() 
        OR master_id IS NULL
        OR EXISTS (
            SELECT 1 FROM master_services ms
            WHERE ms.master_id = auth.uid()
            AND ms.service_id = booking_consultations.service_id
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (role = 'master' OR role = 'owner')
    )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_booking_consultations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS booking_consultations_updated_at ON booking_consultations;
CREATE TRIGGER booking_consultations_updated_at
    BEFORE UPDATE ON booking_consultations
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_consultations_updated_at();

-- Add comment
COMMENT ON TABLE booking_consultations IS 'Pre-booking consultation requests for services requiring approval (e.g., Brow Tattoo)';
COMMENT ON COLUMN booking_consultations.had_before IS 'Has the client had this service before?';
COMMENT ON COLUMN booking_consultations.how_long_ago IS 'How long ago they had the service';
COMMENT ON COLUMN booking_consultations.was_my_work IS 'Was the previous work done by this master?';
COMMENT ON COLUMN booking_consultations.booking_link_token IS 'Unique token for completing booking after approval';
COMMENT ON COLUMN services.requires_consultation IS 'If true, clients must complete pre-booking consultation before booking';
