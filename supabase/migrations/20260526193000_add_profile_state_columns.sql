ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS state_code text;
COMMENT ON COLUMN public.profiles.state IS 'State / region / province name (from CountryStateCity API)';
COMMENT ON COLUMN public.profiles.state_code IS 'ISO state code (e.g. "CA", "NY", "L") used for location filtering';
