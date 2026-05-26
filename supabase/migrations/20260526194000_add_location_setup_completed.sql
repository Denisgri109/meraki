ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_setup_completed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.location_setup_completed IS 'Set to true after the user saves the location gate modal (country + optional state + optional city). Prevents the modal from re-prompting on every app open.';
