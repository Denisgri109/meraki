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

CREATE INDEX IF NOT EXISTS idx_pilates_settings_owner_id ON public.pilates_settings(owner_id);
