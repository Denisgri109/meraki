-- Add master_id to loyalty_rewards
ALTER TABLE loyalty_rewards 
ADD COLUMN IF NOT EXISTS master_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Update RLS policies for loyalty_rewards

-- Drop existing policies to be safe/clean (optional, but good practice if we are redefining)
DROP POLICY IF EXISTS "Masters can manage their own rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Everyone can view active rewards" ON loyalty_rewards;

-- Policy: Masters/Owners can manage (ALL) their own rewards
CREATE POLICY "Masters can manage their own rewards"
  ON loyalty_rewards
  FOR ALL
  USING (auth.uid() = master_id);

-- Policy: Everyone can view active rewards
-- We want clients to see system rewards (master_id IS NULL) AND master rewards
CREATE POLICY "Everyone can view active rewards"
  ON loyalty_rewards
  FOR SELECT
  USING (is_active = true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rewards_master_id ON loyalty_rewards(master_id);
