-- Owner Private Stock System
-- Created: 2026-02-04
-- Feature: Private supply inventory tracking for owners

-- ============================================
-- 1. OWNER SUPPLIES TABLE (Private Inventory)
-- ============================================

CREATE TABLE IF NOT EXISTS owner_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Supply Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Quantity Tracking
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit VARCHAR(50) NOT NULL DEFAULT 'pieces', -- e.g., 'pieces', 'ml', 'grams', 'pairs'
  
  -- Low Stock Alert
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Optional: Cost tracking for reporting
  cost_per_unit DECIMAL(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(owner_id, name)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_owner_supplies_owner_id ON owner_supplies(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_supplies_low_stock ON owner_supplies(owner_id, quantity, low_stock_threshold) WHERE quantity <= low_stock_threshold;

-- RLS for owner_supplies
ALTER TABLE owner_supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own supplies"
  ON owner_supplies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can manage their own supplies"
  ON owner_supplies FOR ALL
  USING (owner_id = auth.uid());

-- ============================================
-- 2. OWNER SUPPLY CONSUMPTION LOG
-- ============================================

CREATE TABLE IF NOT EXISTS owner_supply_consumption_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES owner_supplies(id) ON DELETE CASCADE,
  
  -- Consumption Details
  quantity_used DECIMAL(10,2) NOT NULL,
  quantity_before DECIMAL(10,2) NOT NULL,
  quantity_after DECIMAL(10,2) NOT NULL,
  
  -- Context
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_supply_consumption_supply_id ON owner_supply_consumption_log(supply_id);
CREATE INDEX IF NOT EXISTS idx_owner_supply_consumption_created_at ON owner_supply_consumption_log(created_at DESC);

-- RLS for owner_supply_consumption_log
ALTER TABLE owner_supply_consumption_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their supply consumption logs"
  ON owner_supply_consumption_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM owner_supplies 
      WHERE owner_supplies.id = owner_supply_consumption_log.supply_id 
      AND owner_supplies.owner_id = auth.uid()
    )
  );

CREATE POLICY "System can create owner consumption logs"
  ON owner_supply_consumption_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM owner_supplies 
      WHERE owner_supplies.id = owner_supply_consumption_log.supply_id 
      AND owner_supplies.owner_id = auth.uid()
    )
  );

-- ============================================
-- 3. TRIGGER FUNCTIONS
-- ============================================

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_owner_supplies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to owner_supplies table
CREATE TRIGGER update_owner_supplies_updated_at
  BEFORE UPDATE ON owner_supplies
  FOR EACH ROW EXECUTE FUNCTION update_owner_supplies_updated_at();

-- ============================================
-- 4. FUNCTION: ADJUST OWNER SUPPLY QUANTITY (MANUAL)
-- ============================================

CREATE OR REPLACE FUNCTION adjust_owner_supply_quantity(
  p_supply_id UUID,
  p_new_quantity INTEGER,
  p_reason TEXT DEFAULT 'Manual adjustment'
)
RETURNS VOID AS $$
DECLARE
  current_qty INTEGER;
BEGIN
  -- Get current quantity
  SELECT quantity INTO current_qty
  FROM owner_supplies
  WHERE id = p_supply_id;
  
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Supply not found';
  END IF;
  
  -- Update quantity
  UPDATE owner_supplies
  SET quantity = p_new_quantity
  WHERE id = p_supply_id;
  
  -- Log the adjustment
  INSERT INTO owner_supply_consumption_log (
    supply_id,
    quantity_used,
    quantity_before,
    quantity_after,
    notes,
    created_by
  ) VALUES (
    p_supply_id,
    p_new_quantity - current_qty, -- Positive for add, negative for remove
    current_qty,
    p_new_quantity,
    p_reason,
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION adjust_owner_supply_quantity(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================
-- 5. VIEWS FOR REPORTING
-- ============================================

-- View: Low stock supplies per owner
CREATE OR REPLACE VIEW owner_low_stock_supplies AS
SELECT 
  os.*,
  gs.value::INTEGER as global_threshold,
  (os.quantity <= gs.value::INTEGER) as is_low_stock
FROM owner_supplies os
CROSS JOIN global_settings gs
WHERE gs.key = 'low_stock_threshold';

-- View: Supply usage summary per owner
CREATE OR REPLACE VIEW owner_supply_usage_summary AS
SELECT 
  os.owner_id,
  os.id as supply_id,
  os.name as supply_name,
  os.quantity as current_quantity,
  COALESCE(SUM(oscl.quantity_used), 0) as total_used_30_days
FROM owner_supplies os
LEFT JOIN owner_supply_consumption_log oscl ON oscl.supply_id = os.id 
  AND oscl.created_at >= NOW() - INTERVAL '30 days'
GROUP BY os.owner_id, os.id, os.name, os.quantity;

-- ============================================
-- 6. ENABLE REALTIME FOR OWNER SUPPLIES
-- ============================================

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE owner_supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE owner_supply_consumption_log;
