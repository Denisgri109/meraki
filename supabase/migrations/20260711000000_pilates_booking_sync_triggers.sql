-- Pilates Booking Sync & Alignment Verification
-- Automatically syncs session_id in pilates_session_bookings when appointments are rescheduled
-- Verifies that bookings, sessions, and appointments remain strictly aligned

-- 1. Alignment Verification Trigger Function
CREATE OR REPLACE FUNCTION public.verify_pilates_booking_alignment()
RETURNS TRIGGER AS $$
DECLARE
  v_appt_start timestamptz;
  v_appt_end timestamptz;
  v_appt_client uuid;
  v_appt_service uuid;
  v_session_start timestamptz;
  v_session_end timestamptz;
  v_session_service uuid;
BEGIN
  -- Get appointment details
  SELECT start_time, end_time, client_id, service_id 
  INTO v_appt_start, v_appt_end, v_appt_client, v_appt_service
  FROM public.appointments
  WHERE id = NEW.appointment_id;

  IF v_appt_client IS NULL THEN
    RAISE EXCEPTION 'Associated appointment % not found', NEW.appointment_id;
  END IF;

  -- Get session details
  SELECT starts_at, ends_at, service_id 
  INTO v_session_start, v_session_end, v_session_service
  FROM public.pilates_class_sessions
  WHERE id = NEW.session_id;

  IF v_session_service IS NULL THEN
    RAISE EXCEPTION 'Associated Pilates class session % not found', NEW.session_id;
  END IF;

  -- Verify client alignment
  IF NEW.client_id <> v_appt_client THEN
    RAISE EXCEPTION 'Booking client_id (%) does not match appointment client_id (%)',
      NEW.client_id, v_appt_client;
  END IF;

  -- Verify service alignment
  IF v_appt_service <> v_session_service THEN
    RAISE EXCEPTION 'Appointment service_id (%) does not match Pilates session service_id (%)',
      v_appt_service, v_session_service;
  END IF;

  -- Verify time alignment
  IF v_appt_start <> v_session_start OR v_appt_end <> v_session_end THEN
    RAISE EXCEPTION 'Pilates session times (starts: %, ends: %) do not match appointment times (starts: %, ends: %)',
      v_session_start, v_session_end, v_appt_start, v_appt_end;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Reschedule Synchronization Trigger Function
CREATE OR REPLACE FUNCTION public.sync_pilates_session_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- Check if a Pilates booking exists for this appointment
  IF EXISTS (SELECT 1 FROM public.pilates_session_bookings WHERE appointment_id = NEW.id) THEN
    -- Find a matching active session at the new appointment times
    SELECT id INTO v_session_id
    FROM public.pilates_class_sessions
    WHERE starts_at = NEW.start_time 
      AND ends_at = NEW.end_time
      AND service_id = NEW.service_id
      AND status = 'scheduled'
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
      UPDATE public.pilates_session_bookings
      SET session_id = v_session_id,
          updated_at = now()
      WHERE appointment_id = NEW.id;
    ELSE
      RAISE EXCEPTION 'No matching active Pilates class session found at % for service %', 
        NEW.start_time, NEW.service_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Bind Triggers to Tables
DROP TRIGGER IF EXISTS trigger_verify_pilates_booking_alignment ON public.pilates_session_bookings;
CREATE TRIGGER trigger_verify_pilates_booking_alignment
  BEFORE INSERT OR UPDATE OF session_id, appointment_id, client_id ON public.pilates_session_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_pilates_booking_alignment();

DROP TRIGGER IF EXISTS trigger_sync_pilates_session_booking ON public.appointments;
CREATE TRIGGER trigger_sync_pilates_session_booking
  AFTER UPDATE OF start_time, end_time, service_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pilates_session_booking();
