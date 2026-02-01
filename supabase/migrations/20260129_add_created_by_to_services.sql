-- Add created_by column to track which master/owner created the service
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Masters can manage their own services" ON services;

-- RLS policy: Masters can only manage services they created, owners can manage all
CREATE POLICY "Masters can manage their own services"
  ON services FOR ALL
  USING (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Allow anyone to view active services
DROP POLICY IF EXISTS "Anyone can view active services" ON services;
CREATE POLICY "Anyone can view active services"
  ON services FOR SELECT
  USING (is_active = true);
