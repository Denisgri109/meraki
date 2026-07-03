-- ============================================================================
-- Voucher Validation & QR-Payment System
-- Creates: vouchers, user_vouchers, transactions tables
-- Enables: RLS policies, Realtime on transactions
-- ============================================================================

-- ─── 1. VOUCHERS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text UNIQUE NOT NULL,
    discount_value  numeric(10, 2) NOT NULL CHECK (discount_value > 0),
    discount_type   text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    package_id  text,
    max_uses    integer NOT NULL DEFAULT 1,
    current_uses integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vouchers IS 'Available voucher/promo codes with discount rules';
COMMENT ON COLUMN public.vouchers.discount_type IS 'percentage = % off, fixed = flat euro amount off';

-- ─── 2. USER_VOUCHERS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_vouchers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voucher_id  uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    is_used     boolean NOT NULL DEFAULT false,

    -- Prevent same user from claiming the same voucher twice
    UNIQUE(user_id, voucher_id)
);

COMMENT ON TABLE public.user_vouchers IS 'Links a claimed voucher to a user with a 7-day expiry window';

-- ─── 3. TRANSACTIONS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    stripe_session_id text UNIQUE NOT NULL,
    amount            numeric(10, 2) NOT NULL,
    currency          text NOT NULL DEFAULT 'eur',
    status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    product_name      text,
    product_id        text,
    discount_applied  numeric(10, 2) DEFAULT 0,
    voucher_id        uuid REFERENCES public.vouchers(id) ON DELETE SET NULL,
    metadata          jsonb DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Tracks Stripe Checkout payments with realtime status updates';

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_transactions_updated_at();

-- ─── 4. INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON public.user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_expires_at ON public.user_vouchers(expires_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session ON public.transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- ─── 5. ROW LEVEL SECURITY ─────────────────────────────────────────────────

-- vouchers: all authenticated can read active vouchers; service role manages
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active vouchers"
    ON public.vouchers FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Service role full access on vouchers"
    ON public.vouchers FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- user_vouchers: users see their own; service role manages
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vouchers"
    ON public.user_vouchers FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_vouchers"
    ON public.user_vouchers FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- transactions: users see their own; service role manages
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
    ON public.transactions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on transactions"
    ON public.transactions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ─── 6. ENABLE REALTIME ────────────────────────────────────────────────────
-- The mobile app subscribes to INSERT/UPDATE on this table to show payment success
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
