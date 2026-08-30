-- ============================================================================
-- Attendance confirmation: set client_confirmed, and stop auto-cancel lying
-- (2026-08-30)
--
-- Two platforms, two different code paths, one shared flag:
--
--   * The website updated `appointments` directly and set `client_confirmed`,
--     but never notified the master.
--   * The app called a `client-confirm-appointment` edge function that is not
--     deployed, and a `confirm_appointment_no_payment` RPC that does not
--     exist — so confirming from a push notification always failed.
--
-- Both platforms now call `client_confirm_appointment` (which is deployed) and
-- send the master a push directly. That RPC never set `client_confirmed`,
-- which `auto_cancel_appointment` keys off, so a booking confirmed through it
-- could still be swept up by auto-cancel and the "Confirmed" badge never lit
-- up. This migration makes it set the flag both platforms read.
--
-- Also fixes auto_cancel_appointment's `IF FOUND`, which tested the *second*
-- UPDATE and so reported "Appointment auto-cancelled" for ids that do not
-- exist.
-- ============================================================================

create or replace function public.client_confirm_appointment(
  p_appointment_id uuid,
  p_response       character varying
) returns table(success boolean, new_status text, message text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  v_appointment RECORD;
  v_client_id UUID;
BEGIN
  v_client_id := auth.uid();

  IF v_client_id IS NULL THEN
    RETURN QUERY SELECT false, 'error', 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id AND client_id = v_client_id;

  IF v_appointment IS NULL THEN
    RETURN QUERY SELECT false, 'error', 'Appointment not found'::TEXT;
    RETURN;
  END IF;

  IF v_appointment.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN QUERY SELECT false, v_appointment.status::TEXT,
      'This appointment can no longer be changed.'::TEXT;
    RETURN;
  END IF;

  IF p_response = 'yes' THEN
    UPDATE appointments
    SET status = 'confirmed',
        client_confirmed = true,          -- NEW: the flag both UIs read
        status_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_appointment_id;

    INSERT INTO appointment_confirmations (
      appointment_id, confirmed, confirmed_at, responded_at, response_type
    ) VALUES (
      p_appointment_id, true, NOW(), NOW(), 'yes'
    )
    ON CONFLICT (appointment_id) DO UPDATE
      SET confirmed = true, confirmed_at = NOW(), responded_at = NOW(), response_type = 'yes';

    RETURN QUERY SELECT true, 'confirmed', 'Appointment confirmed!'::TEXT;

  ELSIF p_response = 'no' THEN
    UPDATE appointments
    SET status = 'cancelled',
        client_confirmed = false,
        status_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_appointment_id;

    INSERT INTO appointment_confirmations (
      appointment_id, confirmed, responded_at, response_type
    ) VALUES (
      p_appointment_id, false, NOW(), 'no'
    )
    ON CONFLICT (appointment_id) DO UPDATE
      SET confirmed = false, responded_at = NOW(), response_type = 'no';

    RETURN QUERY SELECT true, 'cancelled', 'Appointment cancelled.'::TEXT;

  ELSE
    RETURN QUERY SELECT false, v_appointment.status::TEXT, 'Invalid response'::TEXT;
  END IF;
END;
$$;


-- auto_cancel_appointment: report what actually happened.
create or replace function public.auto_cancel_appointment(p_appointment_id uuid)
returns table(success boolean, message text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE appointments
  SET status = 'cancelled', status_updated_at = NOW(), updated_at = NOW()
  WHERE id = p_appointment_id
    AND client_confirmed = false
    AND status NOT IN ('cancelled', 'completed', 'no_show');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN QUERY SELECT false, 'Appointment not found or already resolved'::TEXT;
    RETURN;
  END IF;

  UPDATE appointment_confirmations
  SET confirmed = false, response_type = 'timeout', responded_at = NOW()
  WHERE appointment_id = p_appointment_id;

  RETURN QUERY SELECT true, 'Appointment auto-cancelled'::TEXT;
END;
$$;


-- ── cancel_pilates_booking: run after the refund, not instead of it ────────
--
-- Both platforms now cancel a Pilates class in two steps: `cancel-and-refund`
-- handles the card (it refuses an appointment that is already marked
-- cancelled, so it has to go first), then this RPC releases the seat and
-- returns the class credit.
--
-- The old body bailed out with 'Already cancelled' the moment the appointment
-- row said cancelled, which in that order would skip the seat release and the
-- credit refund entirely. It now bails out only when there is genuinely
-- nothing left to do — i.e. the booking row is no longer 'booked'.
--
-- The app previously never called this at all, which is why a class cancelled
-- from the app stayed full for everyone else and swallowed the credit.

create or replace function public.cancel_pilates_booking(
  p_appointment_id      uuid,
  p_refund_window_hours integer default 24
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_client_id uuid;
  v_appt      record;
  v_booking   record;
  v_ledger    record;
  v_pass      record;
  v_refunded  boolean := false;
  v_reason    text;
  v_window    integer;
begin
  v_client_id := auth.uid();
  if v_client_id is null then
    raise exception 'Not authenticated';
  end if;

  select id, client_id, master_id, start_time, status
  into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.client_id <> v_client_id then
    raise exception 'You can only cancel your own appointment';
  end if;

  select coalesce(ms.late_cancellation_window_hours, 24)
  into v_window
  from public.master_settings ms
  where ms.master_id = v_appt.master_id;

  v_window := coalesce(v_window, 24);

  select id, session_id, status
  into v_booking
  from public.pilates_session_bookings
  where appointment_id = p_appointment_id
    and client_id = v_client_id
  for update;

  -- Nothing to release and nothing to refund.
  if v_booking.id is null or v_booking.status <> 'booked' then
    return jsonb_build_object(
      'refunded', false,
      'reason', case
                  when v_booking.id is null then 'No Pilates booking found'
                  else 'Already cancelled'
                end
    );
  end if;

  select *
  into v_ledger
  from public.credit_ledger
  where appointment_id = p_appointment_id
    and user_id = v_client_id
    and reason = 'booking'
    and delta < 0
  order by created_at desc
  limit 1;

  if v_ledger.user_pass_id is not null then
    if extract(epoch from (v_appt.start_time - now())) / 3600.0 > v_window then
      select *
      into v_pass
      from public.user_passes
      where id = v_ledger.user_pass_id
      for update;

      if v_pass.id is not null then
        update public.user_passes
        set remaining_credits = remaining_credits + 1,
            status = 'active'
        where id = v_pass.id
          and remaining_credits < initial_credits;

        if found then
          insert into public.credit_ledger (
            user_pass_id, user_id, delta, balance_after, reason, appointment_id, note
          ) values (
            v_pass.id, v_client_id, 1, v_pass.remaining_credits + 1, 'cancel_refund', p_appointment_id,
            'Refund: cancelled ' || v_window || 'h+ before class'
          );
          v_refunded := true;
        end if;
      end if;
      v_reason := 'Refunded';
    else
      v_reason := 'Late cancellation - no refund';
    end if;
  else
    v_reason := 'No credit used for this booking';
  end if;

  -- Only take the appointment down if something else has not already done so
  -- (cancel-and-refund runs first in the current flow).
  update public.appointments
  set status = 'cancelled',
      cancellation_reason = case
        when v_refunded then 'Cancelled by client (credit refunded)'
        else coalesce(cancellation_reason, 'Cancelled by client')
      end,
      status_updated_at = now()
  where id = p_appointment_id
    and status not in ('cancelled', 'cancelled_free', 'cancelled_charge');

  update public.pilates_session_bookings
  set status = 'cancelled'
  where id = v_booking.id;

  return jsonb_build_object('refunded', v_refunded, 'reason', coalesce(v_reason, 'Cancelled'));
end;
$$;

revoke execute on function public.cancel_pilates_booking(uuid, integer) from public, anon;
grant execute on function public.cancel_pilates_booking(uuid, integer) to authenticated, service_role;
