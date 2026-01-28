-- Create blocked_slots table
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create master_services table
CREATE TABLE IF NOT EXISTS master_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT true,
  custom_price DECIMAL(10,2),
  custom_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(master_id, service_id)
);

-- Create master_availability table (if not exists)
CREATE TABLE IF NOT EXISTS master_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

-- Blocked Slots
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their own blocked slots"
  ON blocked_slots FOR SELECT
  USING (auth.uid() = master_id);

CREATE POLICY "Masters can manage their own blocked slots"
  ON blocked_slots FOR ALL
  USING (auth.uid() = master_id);

CREATE POLICY "Anyone can view blocked slots"
  ON blocked_slots FOR SELECT
  USING (true); -- Clients need to see blocks to avoid booking

-- Master Services
ALTER TABLE master_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage their own services"
  ON master_services FOR ALL
  USING (auth.uid() = master_id);

CREATE POLICY "Anyone can view master services"
  ON master_services FOR SELECT
  USING (true);

-- Master Availability
ALTER TABLE master_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage their own availability"
  ON master_availability FOR ALL
  USING (auth.uid() = master_id);

CREATE POLICY "Anyone can view master availability"
  ON master_availability FOR SELECT
  USING (true);
