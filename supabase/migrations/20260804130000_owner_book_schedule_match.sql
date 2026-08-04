-- owner_book_for_client: enforce schedule + service time-frame match on the beauty branch.
-- The requested start time must be a slot the availability engine (get_available_slots)
-- would offer for this master + service duration: inside master_availability, full service
-- duration fits the window, no overlap with appointments or blocked_slots.
-- Pilates branch is intentionally byte-for-byte unchanged — capacity/status semantics stay green.
-- Applied via Supabase MCP apply_migration (name: owner_book_schedule_match), 2026-08-04.

CREATE OR REPLACE FUNCTION public.owner_book_for_client(
  p_client_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_master_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_start_time timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid;
  v_is_owner boolean;
  v_client_role text;
  v_session record;
  v_booked_count integer;
  v_appointment_id uuid;
  v_master_id uuid;
  v_duration integer;
  v_service record;
  v_end_time timestamptz;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT (p.role = 'owner')::boolean INTO v_is_owner
  FROM public.profiles p WHERE p.id = v_caller;
  IF NOT COALESCE(v_is_owner, false) THEN
    RAISE EXCEPTION 'Not authorized: owner role required' USING ERRCODE = '42501';
  END IF;

  -- Exactly one branch required
  IF (p_session_id IS NOT NULL) = (p_master_id IS NOT NULL AND p_service_id IS NOT NULL AND p_start_time IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one booking branch required: pilates (p_session_id) OR beauty (p_master_id + p_service_id + p_start_time)' USING ERRCODE = '22023';
  END IF;

  SELECT p.role::text INTO v_client_role FROM public.profiles p WHERE p.id = p_client_id;
  IF v_client_role IS NULL OR v_client_role <> 'client' THEN
    RAISE EXCEPTION 'Target client not found or is not a client' USING ERRCODE = 'P0002';
  END IF;

  IF p_session_id IS NOT NULL THEN
    -- PILATES BRANCH (mirrors book_pilates_session, client from param, no Stripe)
    SELECT s.*, svc.base_price, svc.name AS service_name, svc.category AS service_category, h.profile_id AS host_profile_id
    INTO v_session
    FROM public.pilates_class_sessions s
    JOIN public.services svc ON svc.id = s.service_id
    LEFT JOIN public.pilates_hosts h ON h.id = s.host_id
    WHERE s.id = p_session_id
    FOR UPDATE OF s;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pilates session not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_session.status <> 'scheduled' THEN
      RAISE EXCEPTION 'This Pilates session is not available' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.pilates_session_bookings
      WHERE session_id = p_session_id AND client_id = p_client_id AND status = 'booked'
    ) THEN
      RAISE EXCEPTION 'Client is already booked on this session' USING ERRCODE = '23505';
    END IF;

    SELECT count(*) INTO v_booked_count
    FROM public.pilates_session_bookings
    WHERE session_id = p_session_id AND status = 'booked';
    IF v_booked_count >= v_session.capacity THEN
      RAISE EXCEPTION 'This Pilates session is fully booked' USING ERRCODE = 'P0001';
    END IF;

    v_master_id := COALESCE(v_session.host_profile_id, v_session.owner_id);
    v_duration := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_session.ends_at - v_session.starts_at)) / 60.0)::integer);

    INSERT INTO public.appointments (
      master_id, client_id, service_id, start_time, end_time, price, status, notes,
      stripe_setup_intent_id, stripe_payment_intent_id, deposit_amount, deposit_paid,
      deposit_payment_intent_id, service_duration_minutes, requires_confirmation,
      client_confirmed, service_name, service_category
    ) VALUES (
      v_master_id, p_client_id, v_session.service_id, v_session.starts_at, v_session.ends_at,
      v_session.base_price, 'confirmed', p_notes,
      NULL, NULL, 0, false,
      NULL, v_duration, false,
      true, v_session.service_name, v_session.service_category
    )
    RETURNING id INTO v_appointment_id;

    INSERT INTO public.appointment_confirmations (appointment_id, confirmed, confirmed_at)
    VALUES (v_appointment_id, true, now());

    INSERT INTO public.pilates_session_bookings (session_id, appointment_id, client_id, status)
    VALUES (p_session_id, v_appointment_id, p_client_id, 'booked');

    RETURN v_appointment_id;
  END IF;

  -- BEAUTY BRANCH (mirrors book_appointment_with_confirmation, no Stripe)
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_service.duration_minutes IS NULL OR v_service.duration_minutes <= 0 THEN
    RAISE EXCEPTION 'Service has no valid duration' USING ERRCODE = 'P0002';
  END IF;

  v_end_time := p_start_time + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- Schedule + time-frame match: the requested start must be a slot the availability
  -- engine offers for this master and this service duration. This guarantees the
  -- appointment sits inside her availability window, the full service duration fits,
  -- and the slot is clear of blocked slots and other bookings.
  IF NOT EXISTS (
    SELECT 1
    FROM public.get_available_slots(p_master_id, p_start_time::date, v_service.duration_minutes) s
    WHERE s.slot_start = p_start_time
  ) THEN
    RAISE EXCEPTION 'Selected time does not fit the schedule or the service duration. Please choose an available slot.' USING ERRCODE = 'P0001';
  END IF;

  -- Overlap guard (defense in depth; get_available_slots already excludes busy slots)
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.master_id = p_master_id
      AND a.status IN ('confirmed', 'pending')
      AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'This time slot is no longer available' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.appointments (
    master_id, client_id, service_id, start_time, end_time, price, status, notes,
    stripe_setup_intent_id, stripe_payment_intent_id, deposit_amount, deposit_paid,
    deposit_payment_intent_id, service_duration_minutes, requires_confirmation,
    client_confirmed, service_name, service_category
  ) VALUES (
    p_master_id, p_client_id, p_service_id, p_start_time, v_end_time,
    v_service.base_price, 'confirmed', p_notes,
    NULL, NULL, 0, false,
    NULL, v_service.duration_minutes, false,
    true, v_service.name, v_service.category
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_confirmations (appointment_id, confirmed, confirmed_at)
  VALUES (v_appointment_id, true, now());

  RETURN v_appointment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_book_for_client(uuid, uuid, uuid, uuid, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_book_for_client(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_book_for_client(uuid, uuid, uuid, uuid, timestamptz, text) TO authenticated;
