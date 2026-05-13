CREATE OR REPLACE FUNCTION public.book_appointment_with_confirmation(p_master_id uuid, p_service_id uuid, p_start_time timestamp with time zone, p_stripe_setup_intent_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_deposit_amount numeric DEFAULT 0, p_deposit_payment_intent_id text DEFAULT NULL::text, p_credit_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_client_id UUID;
    v_service RECORD;
    v_appointment_id UUID;
    v_end_time TIMESTAMPTZ;
BEGIN
    v_client_id := auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_master_id = v_client_id THEN
        RAISE EXCEPTION 'You cannot book an appointment with yourself';
    END IF;

    SELECT * INTO v_service FROM services WHERE id = p_service_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    v_end_time := p_start_time + (v_service.duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO appointments (
        master_id,
        client_id,
        service_id,
        start_time,
        end_time,
        price,
        status,
        notes,
        stripe_setup_intent_id,
        stripe_payment_intent_id,
        deposit_amount,
        deposit_paid,
        deposit_payment_intent_id
    ) VALUES (
        p_master_id,
        v_client_id,
        p_service_id,
        p_start_time,
        v_end_time,
        v_service.base_price,
        'confirmed',
        p_notes,
        p_stripe_setup_intent_id,
        p_stripe_payment_intent_id,
        p_deposit_amount,
        CASE WHEN p_deposit_amount > 0 THEN TRUE ELSE FALSE END,
        p_deposit_payment_intent_id
    )
    RETURNING id INTO v_appointment_id;

    INSERT INTO appointment_confirmations (
        appointment_id,
        confirmed,
        confirmed_at
    ) VALUES (
        v_appointment_id,
        TRUE,
        NOW()
    );

    IF p_credit_id IS NOT NULL THEN
        UPDATE user_credits
        SET
            is_used = true,
            used_at = NOW(),
            appointment_id = v_appointment_id
        WHERE id = p_credit_id AND user_id = v_client_id AND is_used = false;
    END IF;

    RETURN v_appointment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_appointment_with_confirmation(p_master_id uuid, p_service_id uuid, p_start_time timestamp with time zone, p_stripe_setup_intent_id text, p_stripe_payment_intent_id text, p_notes text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_appointment_id UUID;
  v_service_duration INTEGER;
  v_service_price DECIMAL(10,2);
  v_master_settings RECORD;
  v_confirmation_deadline TIMESTAMPTZ;
  v_client_id UUID;
BEGIN
  v_client_id := auth.uid();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF p_master_id = v_client_id THEN
    RAISE EXCEPTION 'You cannot book an appointment with yourself';
  END IF;

  SELECT duration_minutes, base_price
  INTO v_service_duration, v_service_price
  FROM services
  WHERE id = p_service_id;

  IF v_service_duration IS NULL THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  SELECT confirmation_timing_hours, confirmation_response_timeout_hours
  INTO v_master_settings
  FROM master_settings
  WHERE master_id = p_master_id;

  IF v_master_settings.confirmation_timing_hours IS NULL THEN
    v_master_settings.confirmation_timing_hours := 24;
  END IF;
  IF v_master_settings.confirmation_response_timeout_hours IS NULL THEN
    v_master_settings.confirmation_response_timeout_hours := 24;
  END IF;

  v_confirmation_deadline := calculate_confirmation_deadline(
    p_start_time,
    v_master_settings.confirmation_timing_hours,
    v_master_settings.confirmation_response_timeout_hours
  );

  INSERT INTO appointments (
    client_id, master_id, service_id, start_time, end_time, price, notes,
    stripe_setup_intent_id, stripe_payment_intent_id, confirmation_deadline,
    payment_hold_amount, service_duration_minutes, requires_confirmation
  ) VALUES (
    v_client_id, p_master_id, p_service_id, p_start_time,
    p_start_time + (v_service_duration || ' minutes')::INTERVAL,
    v_service_price, p_notes, p_stripe_setup_intent_id, p_stripe_payment_intent_id,
    v_confirmation_deadline, v_service_price, v_service_duration, true
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO appointment_confirmations (appointment_id, confirmed, created_at)
  VALUES (v_appointment_id, NULL, NOW());

  RETURN v_appointment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_pilates_session(p_session_id uuid, p_stripe_setup_intent_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_deposit_amount numeric DEFAULT 0, p_deposit_payment_intent_id text DEFAULT NULL::text, p_credit_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_id uuid;
  v_session record;
  v_booked_count integer;
  v_appointment_id uuid;
  v_master_id uuid;
  v_duration integer;
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

  v_duration := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_session.ends_at - v_session.starts_at)) / 60.0)::integer);

  INSERT INTO public.appointments (
    master_id,
    client_id,
    service_id,
    start_time,
    end_time,
    price,
    status,
    notes,
    stripe_setup_intent_id,
    stripe_payment_intent_id,
    deposit_amount,
    deposit_paid,
    deposit_payment_intent_id,
    service_duration_minutes,
    requires_confirmation
  ) VALUES (
    v_master_id,
    v_client_id,
    v_session.service_id,
    v_session.starts_at,
    v_session.ends_at,
    v_session.base_price,
    'confirmed',
    p_notes,
    p_stripe_setup_intent_id,
    p_stripe_payment_intent_id,
    p_deposit_amount,
    CASE WHEN p_deposit_amount > 0 THEN true ELSE false END,
    p_deposit_payment_intent_id,
    v_duration,
    false
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_confirmations (
    appointment_id,
    confirmed,
    confirmed_at
  ) VALUES (
    v_appointment_id,
    true,
    now()
  );

  INSERT INTO public.pilates_session_bookings (
    session_id,
    appointment_id,
    client_id,
    status
  ) VALUES (
    p_session_id,
    v_appointment_id,
    v_client_id,
    'booked'
  );

  IF p_credit_id IS NOT NULL THEN
    UPDATE public.user_credits
    SET is_used = true,
        used_at = now(),
        appointment_id = v_appointment_id
    WHERE id = p_credit_id
      AND user_id = v_client_id
      AND is_used = false;
  END IF;

  RETURN v_appointment_id;
END;
$function$;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_no_self_booking
CHECK (client_id <> master_id) NOT VALID;
