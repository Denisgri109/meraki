CREATE TABLE IF NOT EXISTS public.pilates_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  default_capacity integer NOT NULL DEFAULT 6 CHECK (default_capacity > 0 AND default_capacity <= 50),
  default_session_duration_minutes integer NOT NULL DEFAULT 50 CHECK (default_session_duration_minutes > 0 AND default_session_duration_minutes <= 240),
  buffer_minutes integer NOT NULL DEFAULT 10 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 120),
  equipment_provided boolean NOT NULL DEFAULT true,
  require_health_declaration boolean NOT NULL DEFAULT true,
  default_level text NOT NULL DEFAULT 'All levels' CHECK (default_level IN ('Beginner', 'Intermediate', 'Advanced', 'All levels')),
  equipment_notes text,
  location_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pilates_settings_service_id_key UNIQUE (service_id)
);

CREATE TABLE IF NOT EXISTS public.pilates_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pilates_hosts_owner_profile_key
  ON public.pilates_hosts(owner_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pilates_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  host_id uuid REFERENCES public.pilates_hosts(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 50 CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  capacity integer NOT NULL DEFAULT 6 CHECK (capacity > 0 AND capacity <= 50),
  level text NOT NULL DEFAULT 'All levels' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All levels')),
  is_active boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.pilates_class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.pilates_schedule_templates(id) ON DELETE SET NULL,
  host_id uuid REFERENCES public.pilates_hosts(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 6 CHECK (capacity > 0 AND capacity <= 50),
  level text NOT NULL DEFAULT 'All levels' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All levels')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  is_override boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT pilates_class_sessions_template_start_key UNIQUE (template_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_pilates_class_sessions_service_start
  ON public.pilates_class_sessions(service_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_pilates_class_sessions_owner_start
  ON public.pilates_class_sessions(owner_id, starts_at);

CREATE TABLE IF NOT EXISTS public.pilates_session_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pilates_class_sessions(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pilates_session_bookings_appointment_key UNIQUE (appointment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS pilates_session_bookings_one_active_per_client
  ON public.pilates_session_bookings(session_id, client_id)
  WHERE status = 'booked';

ALTER TABLE public.pilates_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilates_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilates_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilates_class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilates_session_bookings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_owner_user(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.update_pilates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_pilates_settings_updated_at ON public.pilates_settings;
CREATE TRIGGER trigger_update_pilates_settings_updated_at
  BEFORE UPDATE ON public.pilates_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_pilates_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pilates_hosts_updated_at ON public.pilates_hosts;
CREATE TRIGGER trigger_update_pilates_hosts_updated_at
  BEFORE UPDATE ON public.pilates_hosts
  FOR EACH ROW EXECUTE FUNCTION public.update_pilates_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pilates_templates_updated_at ON public.pilates_schedule_templates;
CREATE TRIGGER trigger_update_pilates_templates_updated_at
  BEFORE UPDATE ON public.pilates_schedule_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_pilates_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pilates_sessions_updated_at ON public.pilates_class_sessions;
CREATE TRIGGER trigger_update_pilates_sessions_updated_at
  BEFORE UPDATE ON public.pilates_class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_pilates_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pilates_bookings_updated_at ON public.pilates_session_bookings;
CREATE TRIGGER trigger_update_pilates_bookings_updated_at
  BEFORE UPDATE ON public.pilates_session_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_pilates_updated_at();

DROP POLICY IF EXISTS "Authenticated users can view Pilates settings" ON public.pilates_settings;
CREATE POLICY "Authenticated users can view Pilates settings"
  ON public.pilates_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners can manage Pilates settings" ON public.pilates_settings;
CREATE POLICY "Owners can manage Pilates settings"
  ON public.pilates_settings FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner_user(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_owner_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view Pilates hosts" ON public.pilates_hosts;
CREATE POLICY "Authenticated users can view Pilates hosts"
  ON public.pilates_hosts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners can manage Pilates hosts" ON public.pilates_hosts;
CREATE POLICY "Owners can manage Pilates hosts"
  ON public.pilates_hosts FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner_user(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_owner_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view Pilates templates" ON public.pilates_schedule_templates;
CREATE POLICY "Authenticated users can view Pilates templates"
  ON public.pilates_schedule_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage Pilates templates" ON public.pilates_schedule_templates;
CREATE POLICY "Owners can manage Pilates templates"
  ON public.pilates_schedule_templates FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner_user(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_owner_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view Pilates sessions" ON public.pilates_class_sessions;
CREATE POLICY "Authenticated users can view Pilates sessions"
  ON public.pilates_class_sessions FOR SELECT
  TO authenticated
  USING (status = 'scheduled' OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage Pilates sessions" ON public.pilates_class_sessions;
CREATE POLICY "Owners can manage Pilates sessions"
  ON public.pilates_class_sessions FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner_user(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_owner_user(auth.uid()));

DROP POLICY IF EXISTS "Users can view own Pilates bookings" ON public.pilates_session_bookings;
CREATE POLICY "Users can view own Pilates bookings"
  ON public.pilates_session_bookings FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pilates_class_sessions s
      WHERE s.id = session_id AND s.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_non_owner_pilates_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.category = 'Pilates'
     AND NOT public.is_owner_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can create or manage Pilates services';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_non_owner_pilates_service ON public.services;
CREATE TRIGGER trigger_prevent_non_owner_pilates_service
  BEFORE INSERT OR UPDATE OF category ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.prevent_non_owner_pilates_service();

CREATE OR REPLACE FUNCTION public.ensure_pilates_sessions(
  p_service_id uuid,
  p_start_date date DEFAULT current_date,
  p_end_date date DEFAULT (current_date + 30)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service record;
  v_template record;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_rows integer;
  v_total integer := 0;
  v_timezone text;
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

  FOR v_template IN
    SELECT *
    FROM public.pilates_schedule_templates
    WHERE service_id = p_service_id
      AND is_active = true
      AND starts_on <= p_end_date
      AND (ends_on IS NULL OR ends_on >= p_start_date)
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
$$;

CREATE OR REPLACE FUNCTION public.book_pilates_session(
  p_session_id uuid,
  p_stripe_setup_intent_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_deposit_amount numeric DEFAULT 0,
  p_deposit_payment_intent_id text DEFAULT NULL,
  p_credit_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.ensure_pilates_sessions(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_pilates_session(uuid, text, text, text, numeric, text, uuid) TO authenticated;
