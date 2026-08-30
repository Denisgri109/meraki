-- ============================================================================
-- Security hardening — wave 2 (2026-08-30)
--
-- Closes the authorization holes found in the 2026-08-30 joint audit of
-- meraki-WEB and meraki-MOBILE. Every issue below is reachable today from a
-- normal client using nothing but the public anon key, which ships inside the
-- web bundle and the mobile binary.
--
--   1. profiles      — privilege escalation. RLS lets a user UPDATE their own
--                      row with no column restriction, so `role = 'owner'`,
--                      `commission_rate`, `loyalty_points`, `is_verified` and
--                      `stripe_customer_id` are all self-writable.
--   2. anon EXECUTE  — 46 SECURITY DEFINER functions are executable by the
--                      `anon` role. Several mutate money-adjacent state and
--                      trust caller-supplied identity.
--   3. booking RPCs  — book_pilates_session / book_appointment_with_confirmation
--                      write `deposit_paid = true` from a caller-supplied
--                      amount and PaymentIntent id, with no verification that
--                      either is real. A client can book for free.
--   4. appointments  — clients may UPDATE every column of their own
--                      appointment, including price and status.
--   5. search_path   — 46 SECURITY DEFINER functions have a mutable
--                      search_path.
--
-- Behavioural intent: no legitimate flow in either app changes. Every guard
-- added here rejects only inputs that no first-party client sends.
-- ============================================================================


-- ── 1. profiles: block self-service writes to privileged columns ────────────
-- RLS is row-level only, so the column restriction has to be a trigger.
-- The Owner UI, the invite edge functions and the Stripe callbacks all run as
-- service_role or as the owner, both of which are allowed through.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_is_privileged boolean;
begin
  -- service_role (edge functions, Stripe callbacks, cron) and the Owner may
  -- change anything. Everyone else is limited to their own non-privileged
  -- profile fields.
  v_is_privileged :=
    coalesce(auth.role(), '') = 'service_role'
    or public.is_owner_user(auth.uid());

  if v_is_privileged then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Not allowed to change your own role'
      using errcode = '42501';
  end if;

  if new.commission_rate is distinct from old.commission_rate then
    raise exception 'Not allowed to change your own commission rate'
      using errcode = '42501';
  end if;

  if new.loyalty_points is distinct from old.loyalty_points then
    raise exception 'Loyalty points can only be changed by the platform'
      using errcode = '42501';
  end if;

  if new.is_verified is distinct from old.is_verified then
    raise exception 'Not allowed to change your own verification status'
      using errcode = '42501';
  end if;

  if new.master_status is distinct from old.master_status then
    raise exception 'Not allowed to change your own master status'
      using errcode = '42501';
  end if;

  if new.is_master is distinct from old.is_master then
    raise exception 'Not allowed to change your own master flag'
      using errcode = '42501';
  end if;

  if new.invited_by is distinct from old.invited_by then
    raise exception 'Not allowed to change the inviter'
      using errcode = '42501';
  end if;

  -- Stripe identifiers are the anchor for every card-on-file operation.
  -- Letting a user point their profile at somebody else's Stripe customer is
  -- how a saved-card takeover starts.
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'Stripe customer id is managed by the platform'
      using errcode = '42501';
  end if;

  if new.stripe_connect_id is distinct from old.stripe_connect_id then
    raise exception 'Stripe Connect id is managed by the platform'
      using errcode = '42501';
  end if;

  if new.stripe_connect_status is distinct from old.stripe_connect_status then
    raise exception 'Stripe Connect status is managed by the platform'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged_columns on public.profiles;
create trigger trg_guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

comment on function public.guard_profile_privileged_columns() is
  'Blocks self-service UPDATEs to role, commission_rate, loyalty_points, verification, master flags and Stripe identifiers. service_role and the Owner bypass.';


-- ── 2. appointments: clients may only touch their own booking's soft fields ─
-- "Clients can update own appointments" has no WITH CHECK on columns, so a
-- client could set status = 'completed', price = 0 or deposit_paid = true.

create or replace function public.guard_appointment_client_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or public.is_owner_user(auth.uid())
     or auth.uid() = old.master_id
     or auth.uid() is null            -- SECURITY DEFINER RPCs run with the
  then                                -- caller's uid; internal jobs have none
    return new;
  end if;

  if auth.uid() <> old.client_id then
    return new; -- RLS already filtered; nothing for this guard to do
  end if;

  -- The client-facing surfaces (cancel, reschedule request, notes, attendance
  -- confirmation) only ever touch these. Anything else is tampering.
  if new.price              is distinct from old.price
     or new.deposit_amount  is distinct from old.deposit_amount
     or new.deposit_paid    is distinct from old.deposit_paid
     or new.master_id       is distinct from old.master_id
     or new.service_id      is distinct from old.service_id
     or new.client_id       is distinct from old.client_id
     or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     or new.deposit_payment_intent_id is distinct from old.deposit_payment_intent_id
     or new.no_show_charge_amount is distinct from old.no_show_charge_amount
  then
    raise exception 'Clients cannot change the price or payment fields of a booking'
      using errcode = '42501';
  end if;

  -- A client may cancel or confirm. Marking their own booking completed or
  -- no-show is the master's call.
  if new.status is distinct from old.status
     and new.status not in ('cancelled', 'confirmed', 'pending')
  then
    raise exception 'Clients may only cancel or confirm a booking'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_appointment_client_columns on public.appointments;
create trigger trg_guard_appointment_client_columns
  before update on public.appointments
  for each row execute function public.guard_appointment_client_columns();


-- ── 3. A service-role-only ledger of PaymentIntents we actually created ─────
-- Postgres cannot call Stripe, so the booking RPCs need a trust anchor that a
-- client cannot forge. create-payment-intent writes one row here for every
-- PaymentIntent it issues; the booking RPCs below refuse any payment id that
-- is not in this table, owned by the caller, for the right amount.

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
-- SECURITY DEFINER functions below may read or write it.
revoke all on table public.payment_intent_ledger from public, anon, authenticated;
grant all on table public.payment_intent_ledger to service_role;

comment on table public.payment_intent_ledger is
  'Every Stripe PaymentIntent created by the create-payment-intent edge function. The booking RPCs use it to verify that a caller-supplied payment id is real, belongs to the caller and is for the right amount.';


-- ── 4. Booking RPCs: verify the money before writing deposit_paid ───────────
-- Shared helper. Returns silently when the payment checks out, raises otherwise.

create or replace function public.assert_booking_payment(
  p_user_id            uuid,
  p_expected_amount    numeric,
  p_claimed_amount     numeric,
  p_payment_intent_id  text
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_expected_cents integer := round(coalesce(p_expected_amount, 0) * 100)::integer;
  v_claimed_cents  integer := round(coalesce(p_claimed_amount, 0) * 100)::integer;
  v_ledger         record;
begin
  if v_claimed_cents <> v_expected_cents then
    raise exception 'Booking amount mismatch (expected %, got %)',
      (v_expected_cents / 100.0), (v_claimed_cents / 100.0)
      using errcode = '22023';
  end if;

  -- Nothing to pay (fully covered by a credit, or a free class) — no
  -- PaymentIntent is expected and none may be claimed.
  if v_expected_cents = 0 then
    if nullif(p_payment_intent_id, '') is not null then
      raise exception 'No payment is due for this booking'
        using errcode = '22023';
    end if;
    return;
  end if;

  if nullif(p_payment_intent_id, '') is null then
    raise exception 'This booking requires a payment'
      using errcode = '22023';
  end if;

  select * into v_ledger
  from public.payment_intent_ledger
  where stripe_payment_intent_id = p_payment_intent_id;

  if not found then
    raise exception 'Unknown payment reference'
      using errcode = '22023';
  end if;

  if v_ledger.user_id <> p_user_id then
    raise exception 'Payment does not belong to this user'
      using errcode = '42501';
  end if;

  if v_ledger.amount_cents <> v_expected_cents then
    raise exception 'Payment amount does not match the booking'
      using errcode = '22023';
  end if;

  -- One PaymentIntent, one booking.
  if exists (
    select 1 from public.appointments
    where deposit_payment_intent_id = p_payment_intent_id
       or stripe_payment_intent_id  = p_payment_intent_id
  ) then
    raise exception 'This payment has already been used for a booking'
      using errcode = '23505';
  end if;
end;
$$;

revoke execute on function public.assert_booking_payment(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function public.assert_booking_payment(uuid, numeric, numeric, text)
  to authenticated, service_role;


create or replace function public.book_pilates_session(
  p_session_id                uuid,
  p_stripe_setup_intent_id    text default null,
  p_stripe_payment_intent_id  text default null,
  p_notes                     text default null,
  p_deposit_amount            numeric default 0,
  p_deposit_payment_intent_id text default null,
  p_credit_id                 uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  v_client_id uuid;
  v_session record;
  v_booked_count integer;
  v_appointment_id uuid;
  v_master_id uuid;
  v_duration integer;
  v_credit_amount numeric := 0;
  v_expected_amount numeric;
BEGIN
  v_client_id := auth.uid();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    s.*,
    svc.base_price,
    svc.name AS service_name,
    h.profile_id AS host_profile_id
  INTO v_session
  FROM public.pilates_class_sessions s
  JOIN public.services svc ON svc.id = s.service_id
  LEFT JOIN public.pilates_hosts h ON h.id = s.host_id
  WHERE s.id = p_session_id
    AND svc.category = 'Pilates'
    AND svc.is_active = true
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilates session not found';
  END IF;

  IF v_session.status <> 'scheduled' THEN
    RAISE EXCEPTION 'This Pilates session is not available';
  END IF;

  IF v_session.starts_at <= now() THEN
    RAISE EXCEPTION 'This Pilates session has already started';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pilates_session_bookings
    WHERE session_id = p_session_id
      AND client_id = v_client_id
      AND status = 'booked'
  ) THEN
    RAISE EXCEPTION 'You have already booked this Pilates session';
  END IF;

  SELECT count(*)
  INTO v_booked_count
  FROM public.pilates_session_bookings
  WHERE session_id = p_session_id
    AND status = 'booked';

  IF v_booked_count >= v_session.capacity THEN
    RAISE EXCEPTION 'This Pilates session is fully booked';
  END IF;

  v_master_id := COALESCE(v_session.host_profile_id, v_session.owner_id);

  IF v_master_id = v_client_id THEN
    RAISE EXCEPTION 'You cannot book a Pilates session hosted by yourself';
  END IF;

  -- ── NEW: resolve the loyalty credit server-side, then verify the money ──
  IF p_credit_id IS NOT NULL THEN
    SELECT amount INTO v_credit_amount
    FROM public.user_credits
    WHERE id = p_credit_id
      AND user_id = v_client_id
      AND is_used = false
      AND (expires_at IS NULL OR expires_at > now())
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Credit not found, already used, or expired'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  v_expected_amount := GREATEST(0, v_session.base_price - COALESCE(v_credit_amount, 0));

  PERFORM public.assert_booking_payment(
    v_client_id,
    v_expected_amount,
    p_deposit_amount,
    COALESCE(NULLIF(p_deposit_payment_intent_id, ''), NULLIF(p_stripe_payment_intent_id, ''))
  );

  v_duration := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_session.ends_at - v_session.starts_at)) / 60.0)::integer);

  INSERT INTO public.appointments (
    master_id, client_id, service_id, start_time, end_time, price, status, notes,
    stripe_setup_intent_id, stripe_payment_intent_id, deposit_amount, deposit_paid,
    deposit_payment_intent_id, service_duration_minutes, requires_confirmation
  ) VALUES (
    v_master_id, v_client_id, v_session.service_id, v_session.starts_at, v_session.ends_at,
    v_session.base_price, 'confirmed', p_notes,
    p_stripe_setup_intent_id, p_stripe_payment_intent_id, p_deposit_amount,
    CASE WHEN p_deposit_amount > 0 THEN true ELSE false END,
    p_deposit_payment_intent_id, v_duration, false
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_confirmations (appointment_id, confirmed, confirmed_at)
  VALUES (v_appointment_id, true, now());

  INSERT INTO public.pilates_session_bookings (session_id, appointment_id, client_id, status)
  VALUES (p_session_id, v_appointment_id, v_client_id, 'booked');

  IF p_credit_id IS NOT NULL THEN
    UPDATE public.user_credits
    SET is_used = true, used_at = now(), appointment_id = v_appointment_id
    WHERE id = p_credit_id AND user_id = v_client_id AND is_used = false;
  END IF;

  RETURN v_appointment_id;
END;
$$;

revoke execute on function public.book_pilates_session(uuid, text, text, text, numeric, text, uuid)
  from public, anon;
grant execute on function public.book_pilates_session(uuid, text, text, text, numeric, text, uuid)
  to authenticated, service_role;


create or replace function public.book_appointment_with_confirmation(
  p_master_id                 uuid,
  p_service_id                uuid,
  p_start_time                timestamptz,
  p_stripe_setup_intent_id    text default null,
  p_stripe_payment_intent_id  text default null,
  p_notes                     text default null,
  p_deposit_amount            numeric default 0,
  p_deposit_payment_intent_id text default null,
  p_credit_id                 uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
    v_client_id UUID;
    v_service RECORD;
    v_appointment_id UUID;
    v_end_time TIMESTAMPTZ;
    v_credit_amount NUMERIC := 0;
    v_expected_amount NUMERIC;
BEGIN
    v_client_id := auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_master_id = v_client_id THEN
        RAISE EXCEPTION 'You cannot book an appointment with yourself';
    END IF;

    SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    IF coalesce(v_service.is_active, true) = false THEN
        RAISE EXCEPTION 'Service is not available';
    END IF;

    IF p_start_time <= now() THEN
        RAISE EXCEPTION 'Cannot book a time in the past';
    END IF;

    v_end_time := p_start_time + (v_service.duration_minutes || ' minutes')::INTERVAL;

    -- ── NEW: the slot must be free. Previously there was no overlap check at
    -- all on the client self-booking path, so two clients could take the same
    -- slot and a client could book over a blocked slot.
    IF EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.master_id = p_master_id
          AND a.status NOT IN ('cancelled', 'no_show')
          AND tstzrange(a.start_time, a.end_time, '[)')
              && tstzrange(p_start_time, v_end_time, '[)')
    ) THEN
        RAISE EXCEPTION 'That time slot is no longer available'
          USING ERRCODE = '23505';
    END IF;

    -- ── NEW: resolve the credit and verify the money ──
    IF p_credit_id IS NOT NULL THEN
        SELECT amount INTO v_credit_amount
        FROM public.user_credits
        WHERE id = p_credit_id
          AND user_id = v_client_id
          AND is_used = false
          AND (expires_at IS NULL OR expires_at > now())
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Credit not found, already used, or expired'
              USING ERRCODE = '22023';
        END IF;
    END IF;

    v_expected_amount := GREATEST(0, v_service.base_price - COALESCE(v_credit_amount, 0));

    PERFORM public.assert_booking_payment(
      v_client_id,
      v_expected_amount,
      p_deposit_amount,
      COALESCE(NULLIF(p_deposit_payment_intent_id, ''), NULLIF(p_stripe_payment_intent_id, ''))
    );

    INSERT INTO public.appointments (
        master_id, client_id, service_id, start_time, end_time, price, status, notes,
        stripe_setup_intent_id, stripe_payment_intent_id, deposit_amount, deposit_paid,
        deposit_payment_intent_id
    ) VALUES (
        p_master_id, v_client_id, p_service_id, p_start_time, v_end_time,
        v_service.base_price, 'confirmed', p_notes,
        p_stripe_setup_intent_id, p_stripe_payment_intent_id, p_deposit_amount,
        CASE WHEN p_deposit_amount > 0 THEN TRUE ELSE FALSE END,
        p_deposit_payment_intent_id
    )
    RETURNING id INTO v_appointment_id;

    INSERT INTO public.appointment_confirmations (appointment_id, confirmed, confirmed_at)
    VALUES (v_appointment_id, TRUE, NOW());

    IF p_credit_id IS NOT NULL THEN
        UPDATE public.user_credits
        SET is_used = true, used_at = NOW(), appointment_id = v_appointment_id
        WHERE id = p_credit_id AND user_id = v_client_id AND is_used = false;
    END IF;

    RETURN v_appointment_id;
END;
$$;

revoke execute on function public.book_appointment_with_confirmation(uuid, uuid, timestamptz, text, text, text, numeric, text, uuid)
  from public, anon;
grant execute on function public.book_appointment_with_confirmation(uuid, uuid, timestamptz, text, text, text, numeric, text, uuid)
  to authenticated, service_role;


-- ── 5. Loyalty: stop trusting caller-supplied user ids ─────────────────────

create or replace function public.redeem_reward(p_reward_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
    v_reward loyalty_rewards%ROWTYPE;
    v_current_points INTEGER;
    v_credit_id UUID;
    v_uid UUID;
BEGIN
    -- Identity comes from the session. p_user_id is honoured only for the
    -- server (service_role) so the existing edge functions keep working.
    v_uid := coalesce(
      auth.uid(),
      case when coalesce(auth.role(), '') = 'service_role' then p_user_id end
    );

    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id <> v_uid
       AND coalesce(auth.role(), '') <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
    END IF;

    SELECT * INTO v_reward
    FROM loyalty_rewards
    WHERE id = p_reward_id AND is_active = true;

    IF v_reward.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Reward not found or inactive');
    END IF;

    SELECT loyalty_points INTO v_current_points
    FROM profiles WHERE id = v_uid FOR UPDATE;

    IF v_current_points IS NULL OR v_current_points < v_reward.points_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient points');
    END IF;

    UPDATE profiles
    SET loyalty_points = loyalty_points - v_reward.points_cost
    WHERE id = v_uid;

    INSERT INTO loyalty_transactions (user_id, points, type, description)
    VALUES (v_uid, -v_reward.points_cost, 'redeemed', 'Redeemed: ' || v_reward.name);

    INSERT INTO user_credits (user_id, reward_id, credit_type, amount, description, expires_at)
    VALUES (
        v_uid, v_reward.id,
        COALESCE(v_reward.credit_type, 'discount'),
        COALESCE(v_reward.discount_amount, 0),
        v_reward.name,
        NOW() + INTERVAL '90 days'
    )
    RETURNING id INTO v_credit_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reward redeemed! Credit added to your account.',
        'new_balance', v_current_points - v_reward.points_cost,
        'credit_id', v_credit_id,
        'credit_amount', COALESCE(v_reward.discount_amount, 0)
    );
END;
$$;


create or replace function public.redeem_stamp_card(p_client_stamp_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  v_stamps_collected INTEGER;
  v_stamps_required INTEGER;
  v_card_name TEXT;
  v_uid UUID;
BEGIN
  v_uid := coalesce(
    auth.uid(),
    case when coalesce(auth.role(), '') = 'service_role' then p_client_id end
  );

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF p_client_id IS NOT NULL AND p_client_id <> v_uid
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;

  SELECT cs.stamps_collected, lc.stamps_required, lc.name
  INTO v_stamps_collected, v_stamps_required, v_card_name
  FROM client_stamps cs
  JOIN loyalty_cards lc ON cs.loyalty_card_id = lc.id
  WHERE cs.id = p_client_stamp_id
    AND cs.client_id = v_uid
  FOR UPDATE OF cs;

  IF v_stamps_collected IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Stamp card not found');
  END IF;

  IF v_stamps_collected < v_stamps_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('You need %s more stamps to redeem', v_stamps_required - v_stamps_collected)
    );
  END IF;

  UPDATE client_stamps
  SET stamps_collected = stamps_collected - v_stamps_required,
      stamps_redeemed = stamps_redeemed + 1,
      last_redeemed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_client_stamp_id;

  INSERT INTO stamp_history (client_stamp_id, action, stamps_change, notes)
  VALUES (p_client_stamp_id, 'redeemed', -v_stamps_required, 'Reward redeemed');

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Reward redeemed for %s! Show this to your Master.', v_card_name)
  );
END;
$$;


create or replace function public.get_client_stamp_cards(p_client_id uuid)
returns table(
  stamp_id uuid, card_id uuid, card_name text, card_description text,
  master_id uuid, master_name text, master_avatar text,
  stamps_collected integer, stamps_required integer, stamps_redeemed integer,
  reward_type text, reward_value numeric, reward_available boolean,
  last_stamp_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- A client sees their own cards; a master/owner may look up any client's.
  IF v_uid IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NOT NULL
     AND p_client_id <> v_uid
     AND NOT public.is_owner_user(v_uid)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role = 'master')
  THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    cs.id, lc.id, lc.name::TEXT, lc.description::TEXT,
    p.id, p.full_name::TEXT, p.avatar_url::TEXT,
    cs.stamps_collected, lc.stamps_required, cs.stamps_redeemed,
    lc.reward_type::TEXT, lc.reward_value,
    (cs.stamps_collected >= lc.stamps_required),
    cs.last_stamp_at
  FROM client_stamps cs
  JOIN loyalty_cards lc ON cs.loyalty_card_id = lc.id
  JOIN profiles p ON lc.master_id = p.id
  WHERE cs.client_id = p_client_id
    AND lc.is_active = true
  ORDER BY cs.last_stamp_at DESC;
END;
$$;


-- ── 6. Supplies: authorise the adjuster ────────────────────────────────────
-- Both functions wrote auth.uid() into the audit column but never checked it,
-- so anyone (including anon) could set any supply row to any quantity.

create or replace function public.adjust_supply_quantity(
  p_supply_id uuid, p_new_quantity integer, p_reason text default 'Manual adjustment'
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  current_qty INTEGER;
  v_master_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be zero or more' USING ERRCODE = '22023';
  END IF;

  SELECT quantity, master_id INTO current_qty, v_master_id
  FROM master_supplies WHERE id = p_supply_id FOR UPDATE;

  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Supply not found';
  END IF;

  IF v_uid IS NOT NULL AND v_master_id <> v_uid AND NOT public.is_owner_user(v_uid) THEN
    RAISE EXCEPTION 'Not allowed to adjust this supply' USING ERRCODE = '42501';
  END IF;

  UPDATE master_supplies SET quantity = p_new_quantity WHERE id = p_supply_id;

  INSERT INTO supply_consumption_log (
    supply_id, quantity_used, quantity_before, quantity_after, notes, created_by
  ) VALUES (
    p_supply_id, p_new_quantity - current_qty, current_qty, p_new_quantity, p_reason, v_uid
  );
END;
$$;


create or replace function public.adjust_owner_supply_quantity(
  p_supply_id uuid, p_new_quantity integer, p_reason text default 'Manual adjustment'
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  current_qty INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT (public.is_owner_user(v_uid) OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Only the Owner can adjust owner stock' USING ERRCODE = '42501';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be zero or more' USING ERRCODE = '22023';
  END IF;

  SELECT quantity INTO current_qty
  FROM owner_supplies WHERE id = p_supply_id FOR UPDATE;

  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Supply not found';
  END IF;

  UPDATE owner_supplies SET quantity = p_new_quantity WHERE id = p_supply_id;

  INSERT INTO owner_supply_consumption_log (
    supply_id, quantity_used, quantity_before, quantity_after, notes, created_by
  ) VALUES (
    p_supply_id, p_new_quantity - current_qty, current_qty, p_new_quantity, p_reason, v_uid
  );
END;
$$;


-- ── 7. Take EXECUTE away from anon (and PUBLIC) ────────────────────────────
-- Everything below is either a trigger function (never called directly), a
-- cron/service routine, or a user action that has no meaning without a
-- session. `get_available_slots` is deliberately left public: the marketing
-- site shows availability before login.

do $$
declare
  v_fn text;
  v_sig text;
  -- Server-side / cron only.
  v_service_only text[] := array[
    'invoke_edge_function',
    'cleanup_orphaned_profiles',
    'auto_cancel_appointment',
    'expire_voucher_redemptions',
    'get_appointments_for_auto_cancel',
    'get_appointments_needing_confirmation_reminder',
    'get_master_clients',
    'handle_user_delete',
    'schedule_appointment_reminders'
  ];
  -- Requires a logged-in user.
  v_auth_only text[] := array[
    'add_loyalty_stamp',
    'adjust_owner_supply_quantity',
    'adjust_supply_quantity',
    'book_appointment',
    'client_arrived_late',
    'client_confirm_appointment',
    'get_client_stamp_cards',
    'get_master_deposit_settings',
    'mark_conversation_read',
    'process_no_show_charge',
    'process_qr_scan',
    'process_stamp_scan',
    'redeem_class_credit',
    'redeem_reward',
    'redeem_stamp_card',
    'reschedule_pilates_session'
  ];
begin
  for v_fn, v_sig in
    select p.proname, pg_get_function_identity_arguments(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (v_service_only || v_auth_only)
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', v_fn, v_sig);
    if v_fn = any (v_auth_only) then
      execute format('grant execute on function public.%I(%s) to authenticated', v_fn, v_sig);
    end if;
    execute format('grant execute on function public.%I(%s) to service_role', v_fn, v_sig);
  end loop;
end;
$$;


-- ── 8. Pin search_path on every remaining SECURITY DEFINER function ─────────
-- A mutable search_path on a SECURITY DEFINER function is a privilege
-- escalation primitive for anyone who can create objects in a schema that
-- appears earlier in the path.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proconfig is null
           or not exists (
             select 1 from unnest(p.proconfig) c where c like 'search_path=%'
           ))
  loop
    execute format('alter function %s set search_path to ''public'', ''pg_temp''', r.sig);
  end loop;
end;
$$;
