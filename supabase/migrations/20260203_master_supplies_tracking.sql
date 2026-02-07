-- Master Onboarding & Supply Tracking Migration
-- Created: 2026-02-03
-- Features: Instant master access, supply inventory tracking, auto-deduction

-- ============================================
-- 1. ADD ONBOARDING FIELD TO PROFILES
-- ============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing masters to have onboarding_completed = TRUE
UPDATE profiles 
SET onboarding_completed = TRUE 
WHERE role = 'master' AND onboarding_completed IS NULL;

-- ============================================
-- 2. MASTER SUPPLIES TABLE (Private Inventory)
-- ============================================

CREATE TABLE IF NOT EXISTS master_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
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
  
  UNIQUE(master_id, name)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_master_supplies_master_id ON master_supplies(master_id);
CREATE INDEX IF NOT EXISTS idx_master_supplies_low_stock ON master_supplies(master_id, quantity, low_stock_threshold) WHERE quantity <= low_stock_threshold;

-- RLS for master_supplies
ALTER TABLE master_supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their own supplies"
  ON master_supplies FOR SELECT
  USING (master_id = auth.uid());

CREATE POLICY "Masters can manage their own supplies"
  ON master_supplies FOR ALL
  USING (master_id = auth.uid());

-- ============================================
-- 3. SERVICE SUPPLIES LINK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS service_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES master_supplies(id) ON DELETE CASCADE,
  
  -- How much of this supply is used per service
  quantity_per_service DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity_per_service > 0),
  
  -- Notes (e.g., "1 tray for full set, 0.5 for refill")
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(service_id, supply_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_supplies_service_id ON service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_supplies_supply_id ON service_supplies(supply_id);

-- RLS for service_supplies
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view service supplies for their services"
  ON service_supplies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_supplies.service_id 
      AND services.created_by = auth.uid()
    )
  );

CREATE POLICY "Masters can manage service supplies for their services"
  ON service_supplies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_supplies.service_id 
      AND services.created_by = auth.uid()
    )
  );

-- ============================================
-- 4. SUPPLY CONSUMPTION LOG
-- ============================================

CREATE TABLE IF NOT EXISTS supply_consumption_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES master_supplies(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
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
CREATE INDEX IF NOT EXISTS idx_supply_consumption_supply_id ON supply_consumption_log(supply_id);
CREATE INDEX IF NOT EXISTS idx_supply_consumption_appointment ON supply_consumption_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_supply_consumption_created_at ON supply_consumption_log(created_at DESC);

-- RLS for supply_consumption_log
ALTER TABLE supply_consumption_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their supply consumption logs"
  ON supply_consumption_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM master_supplies 
      WHERE master_supplies.id = supply_consumption_log.supply_id 
      AND master_supplies.master_id = auth.uid()
    )
  );

CREATE POLICY "System can create consumption logs"
  ON supply_consumption_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM master_supplies 
      WHERE master_supplies.id = supply_consumption_log.supply_id 
      AND master_supplies.master_id = auth.uid()
    )
  );

-- ============================================
-- 5. GLOBAL SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default low stock threshold
INSERT INTO global_settings (key, value, description)
VALUES (
  'low_stock_threshold', 
  '5', 
  'Default threshold for low stock alerts across all master inventories'
)
ON CONFLICT (key) DO NOTHING;

-- RLS for global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global settings"
  ON global_settings FOR SELECT
  USING (true);

CREATE POLICY "Only owners can update global settings"
  ON global_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'owner'
    )
  );

-- ============================================
-- 6. TRIGGER FUNCTIONS
-- ============================================

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_master_supplies_updated_at
  BEFORE UPDATE ON master_supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_supplies_updated_at
  BEFORE UPDATE ON service_supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. FUNCTION: DEDUCT SUPPLIES ON APPOINTMENT COMPLETION
-- ============================================

CREATE OR REPLACE FUNCTION deduct_supplies_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  supply_record RECORD;
  current_quantity INTEGER;
  new_quantity INTEGER;
  global_threshold INTEGER;
BEGIN
  -- Only run when status changes TO 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get global low stock threshold
    SELECT value::INTEGER INTO global_threshold
    FROM global_settings
    WHERE key = 'low_stock_threshold';
    
    IF global_threshold IS NULL THEN
      global_threshold := 5;
    END IF;
    
    -- Loop through all supplies linked to this service
    FOR supply_record IN 
      SELECT 
        ms.id as supply_id,
        ms.quantity as current_qty,
        ss.quantity_per_service,
        ms.name as supply_name
      FROM service_supplies ss
      JOIN master_supplies ms ON ms.id = ss.supply_id
      WHERE ss.service_id = NEW.service_id
      AND ms.master_id = NEW.master_id
    LOOP
      -- Calculate new quantity
      current_quantity := supply_record.current_qty;
      new_quantity := current_quantity - supply_record.quantity_per_service::INTEGER;
      
      -- Don't go below zero
      IF new_quantity < 0 THEN
        new_quantity := 0;
      END IF;
      
      -- Update supply quantity
      UPDATE master_supplies 
      SET quantity = new_quantity
      WHERE id = supply_record.supply_id;
      
      -- Log the consumption
      INSERT INTO supply_consumption_log (
        supply_id,
        appointment_id,
        quantity_used,
        quantity_before,
        quantity_after,
        notes,
        created_by
      ) VALUES (
        supply_record.supply_id,
        NEW.id,
        supply_record.quantity_per_service,
        current_quantity,
        new_quantity,
        'Auto-deducted on appointment completion',
        NEW.master_id
      );
      
      -- Check if we hit low stock (optional: could trigger notification here)
      IF new_quantity <= global_threshold AND current_quantity > global_threshold THEN
        -- Low stock threshold crossed - could emit event or call edge function here
        RAISE NOTICE 'Supply % is now low stock: % remaining', supply_record.supply_name, new_quantity;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to appointments
CREATE TRIGGER trigger_deduct_supplies_on_completion
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION deduct_supplies_on_completion();

-- ============================================
-- 8. FUNCTION: RESTORE SUPPLIES ON APPOINTMENT CANCEL/DELETE
-- ============================================

CREATE OR REPLACE FUNCTION restore_supplies_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  consumption_record RECORD;
BEGIN
  -- If appointment is being cancelled or deleted, restore supplies
  IF NEW.status = 'cancelled' OR TG_OP = 'DELETE' THEN
    -- Loop through consumption logs for this appointment
    FOR consumption_record IN 
      SELECT 
        scl.supply_id,
        scl.quantity_used,
        ms.quantity as current_qty
      FROM supply_consumption_log scl
      JOIN master_supplies ms ON ms.id = scl.supply_id
      WHERE scl.appointment_id = COALESCE(NEW.id, OLD.id)
    LOOP
      -- Restore the quantity
      UPDATE master_supplies 
      SET quantity = consumption_record.current_qty + consumption_record.quantity_used
      WHERE id = consumption_record.supply_id;
      
      -- Mark the consumption log as reversed
      UPDATE supply_consumption_log
      SET notes = COALESCE(notes, '') || ' [REVERSED - Appointment Cancelled]'
      WHERE supply_id = consumption_record.supply_id
      AND appointment_id = COALESCE(NEW.id, OLD.id);
    END LOOP;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER trigger_restore_supplies_on_cancel
  BEFORE UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled')
  EXECUTE FUNCTION restore_supplies_on_cancel();

-- ============================================
-- 9. FUNCTION: ADJUST SUPPLY QUANTITY (MANUAL)
-- ============================================

CREATE OR REPLACE FUNCTION adjust_supply_quantity(
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
  FROM master_supplies
  WHERE id = p_supply_id;
  
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Supply not found';
  END IF;
  
  -- Update quantity
  UPDATE master_supplies
  SET quantity = p_new_quantity
  WHERE id = p_supply_id;
  
  -- Log the adjustment
  INSERT INTO supply_consumption_log (
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

-- ============================================
-- 10. VIEWS FOR REPORTING
-- ============================================

-- View: Low stock supplies per master
CREATE OR REPLACE VIEW low_stock_supplies AS
SELECT 
  ms.*,
  gs.value::INTEGER as global_threshold,
  (ms.quantity <= gs.value::INTEGER) as is_low_stock
FROM master_supplies ms
CROSS JOIN global_settings gs
WHERE gs.key = 'low_stock_threshold';

-- View: Supply usage summary per master
CREATE OR REPLACE VIEW supply_usage_summary AS
SELECT 
  ms.master_id,
  ms.id as supply_id,
  ms.name as supply_name,
  ms.quantity as current_quantity,
  COALESCE(SUM(scl.quantity_used), 0) as total_used_30_days
FROM master_supplies ms
LEFT JOIN supply_consumption_log scl ON scl.supply_id = ms.id 
  AND scl.created_at >= NOW() - INTERVAL '30 days'
GROUP BY ms.master_id, ms.id, ms.name, ms.quantity;

-- ============================================
-- 11. ENABLE REALTIME FOR SUPPLIES
-- ============================================

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE master_supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE supply_consumption_log;
