-- Add operating_days column to pilates_settings (which weekdays the studio runs)
-- 0=Sun, 6=Sat. Defaults to all 7 days.
ALTER TABLE public.pilates_settings
  ADD COLUMN IF NOT EXISTS operating_days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::integer[];

ALTER TABLE public.pilates_settings
  DROP CONSTRAINT IF EXISTS pilates_settings_operating_days_valid;
ALTER TABLE public.pilates_settings
  ADD CONSTRAINT pilates_settings_operating_days_valid
  CHECK (
    operating_days <@ ARRAY[0,1,2,3,4,5,6]
    AND array_length(operating_days, 1) IS NOT NULL
    AND array_length(operating_days, 1) > 0
  );

COMMENT ON COLUMN public.pilates_settings.operating_days IS
  'Array of weekdays (0=Sun..6=Sat) on which this Pilates studio is open. Sessions are never auto-generated on days not in this list.';

-- Update ensure_pilates_sessions to respect operating_days:
--  * skip templates whose day_of_week is not in operating_days
--  * delete future auto-generated, unbooked sessions on days that are now off
CREATE OR REPLACE FUNCTION public.ensure_pilates_sessions(
  p_service_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT (CURRENT_DATE + 30)
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_service record;
  v_template record;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_rows integer;
  v_total integer := 0;
  v_timezone text;
  v_operating_days integer[];
BEGIN
  IF p_end_date < p_start_date THEN
    RETURN 0;
  END IF;

  IF p_end_date > p_start_date + 180 THEN
    RAISE EXCEPTION 'Date range too large';
  END IF;

  SELECT s.id, s.created_by AS owner_id, p.timezone
  INTO v_service
  FROM public.services s
  JOIN public.profiles p ON p.id = s.created_by
  WHERE s.id = p_service_id
    AND s.category = 'Pilates'
    AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active Pilates service not found';
  END IF;

  v_timezone := COALESCE(v_service.timezone, 'Europe/London');

  SELECT operating_days
  INTO v_operating_days
  FROM public.pilates_settings
  WHERE service_id = p_service_id;

  IF v_operating_days IS NULL THEN
    v_operating_days := ARRAY[0,1,2,3,4,5,6];
  END IF;

  -- Remove future auto-generated, unbooked sessions on off-days so that
  -- changing operating_days takes effect immediately for unbooked slots.
  DELETE FROM public.pilates_class_sessions s
  WHERE s.service_id = p_service_id
    AND s.starts_at >= GREATEST(now(), (p_start_date::timestamp AT TIME ZONE v_timezone))
    AND s.is_override = false
    AND NOT (EXTRACT(DOW FROM (s.starts_at AT TIME ZONE v_timezone))::integer = ANY (v_operating_days))
    AND NOT EXISTS (
      SELECT 1 FROM public.pilates_session_bookings b
      WHERE b.session_id = s.id AND b.status = 'booked'
    );

  FOR v_template IN
    SELECT *
    FROM public.pilates_schedule_templates
    WHERE service_id = p_service_id
      AND is_active = true
      AND starts_on <= p_end_date
      AND (ends_on IS NULL OR ends_on >= p_start_date)
      AND day_of_week = ANY (v_operating_days)
  LOOP
    FOR v_day IN
      SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date
    LOOP
      IF EXTRACT(DOW FROM v_day)::integer = v_template.day_of_week
         AND v_day >= v_template.starts_on
         AND (v_template.ends_on IS NULL OR v_day <= v_template.ends_on) THEN
        v_start := ((v_day + v_template.start_time) AT TIME ZONE v_timezone);
        v_end := v_start + make_interval(mins => v_template.duration_minutes);

        INSERT INTO public.pilates_class_sessions (
          owner_id,
          service_id,
          template_id,
          host_id,
          starts_at,
          ends_at,
          capacity,
          level,
          status,
          is_override,
          notes
        ) VALUES (
          v_template.owner_id,
          v_template.service_id,
          v_template.id,
          v_template.host_id,
          v_start,
          v_end,
          v_template.capacity,
          v_template.level,
          'scheduled',
          false,
          v_template.notes
        )
        ON CONFLICT (template_id, starts_at) DO UPDATE
        SET host_id = EXCLUDED.host_id,
            ends_at = EXCLUDED.ends_at,
            capacity = EXCLUDED.capacity,
            level = EXCLUDED.level,
            notes = EXCLUDED.notes,
            updated_at = now()
        WHERE public.pilates_class_sessions.is_override = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.pilates_session_bookings b
            WHERE b.session_id = public.pilates_class_sessions.id
              AND b.status = 'booked'
          );

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_total := v_total + v_rows;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_total;
END;
$function$;
