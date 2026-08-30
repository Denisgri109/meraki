-- ============================================================================
-- payment_intent_ledger (2026-08-30)
--
-- Split out of 20260830120000_security_hardening_wave2.sql so it can go live
-- *before* the create-payment-intent edge function is redeployed, and the
-- edge function before the booking guard that reads it. Applying them the
-- other way round would reject legitimate bookings for as long as the ledger
-- was empty.
--
-- The wave-2 migration re-declares this with `create table if not exists`, so
-- running it afterwards is a no-op.
--
-- Postgres cannot call Stripe. This table is the only thing the booking RPCs
-- can trust when a client hands them a PaymentIntent id.
-- ============================================================================

create table if not exists public.payment_intent_ledger (
  stripe_payment_intent_id text primary key,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text not null default 'eur',
  purpose                  text,
  created_at               timestamptz not null default now()
);

create index if not exists payment_intent_ledger_user_idx
  on public.payment_intent_ledger (user_id, created_at desc);

alter table public.payment_intent_ledger enable row level security;

-- Deliberately no policies: only service_role (which bypasses RLS) and the
-- SECURITY DEFINER booking functions may read or write it.
revoke all on table public.payment_intent_ledger from public, anon, authenticated;
grant all on table public.payment_intent_ledger to service_role;

comment on table public.payment_intent_ledger is
  'Every Stripe PaymentIntent created by the create-payment-intent edge function. The booking RPCs use it to verify that a caller-supplied payment id is real, belongs to the caller and is for the right amount.';
