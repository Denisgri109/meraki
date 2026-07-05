-- ============================================================================
-- QR Payment Board: dynamic product catalog
-- Adds a `qr_enabled` flag to products so the owner can choose which items
-- (shop products AND on-site-only items) appear on the QR Payment Board.
-- The create-stripe-session edge function reads the price from this table,
-- keeping the server as the single source of truth (price-tamper-proof).
-- ============================================================================

-- 1. Add the qr_enabled flag (default false so existing products stay off the
--    board until the owner opts them in).
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT false;

-- 2. Backfill the 6 launch-day on-site items. If they already exist in the
--    products table (matched by name), flip qr_enabled on. If they don't exist,
--    insert them as new active products with qr_enabled = true.
--    Safe to re-run (idempotent via ON CONFLICT).
UPDATE products SET qr_enabled = true, is_active = true
WHERE name IN (
    'Merakí Cozy Socks',
    'Merakí Premium Tee',
    'Signature Dad Cap',
    'Microfiber Salon Towel',
    'Canvas Tote Bag',
    'Ultimate Care Combo'
);

INSERT INTO products (name, description, retail_price, wholesale_price, stock_count, category, is_active, qr_enabled)
VALUES
    ('Merakí Cozy Socks',    'Soft, organic cotton salon socks',          16.00, 16.00, 100, 'On-Site', true, true),
    ('Merakí Premium Tee',   'Relaxed fit, ultra-soft daily wear',        25.00, 25.00, 100, 'On-Site', true, true),
    ('Signature Dad Cap',    'Embroidered logo, adjustable strap',        20.00, 20.00, 100, 'On-Site', true, true),
    ('Microfiber Salon Towel','Quick-dry, absorbent hair towel',          12.50, 12.50, 100, 'On-Site', true, true),
    ('Canvas Tote Bag',      'Eco-friendly, spacious everyday carry',     10.00, 10.00, 100, 'On-Site', true, true),
    ('Ultimate Care Combo',  'Socks + Tee + Tote bag premium bundle',     45.00, 45.00, 100, 'On-Site', true, true)
ON CONFLICT DO NOTHING;

-- 3. RLS: owners can already INSERT/UPDATE/DELETE products (the inventory page
--    relies on it). This just makes sure qr_enabled is covered by the existing
--    owner-write policy. The SELECT policy already lets authenticated users
--    read active products. No new policy needed unless the existing one is
--    restricted — verified by the inventory page working client-side.
