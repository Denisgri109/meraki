-- Allow services to be hard-deleted while preserving appointment history
-- by snapshotting service name/category onto appointments and changing
-- the FKs from RESTRICT to SET NULL.

-- 1. Add snapshot columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS service_category text;

-- 2. Backfill snapshots from current services. Temporarily drop the
--    NOT VALID self-booking CHECK so legacy rows do not block the UPDATE.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_self_booking;

UPDATE public.appointments a
SET service_name = s.name,
    service_category = s.category
FROM public.services s
WHERE a.service_id = s.id
  AND (a.service_name IS NULL OR a.service_category IS NULL);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_self_booking CHECK (client_id <> master_id) NOT VALID;

-- 3. Trigger to populate snapshot on INSERT/UPDATE of service_id
CREATE OR REPLACE FUNCTION public.snapshot_appointment_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    IF NEW.service_name IS NULL OR NEW.service_category IS NULL
       OR TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.service_id IS DISTINCT FROM OLD.service_id) THEN
      SELECT s.name, s.category
        INTO NEW.service_name, NEW.service_category
        FROM public.services s
        WHERE s.id = NEW.service_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_snapshot_appointment_service ON public.appointments;
CREATE TRIGGER trigger_snapshot_appointment_service
BEFORE INSERT OR UPDATE OF service_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.snapshot_appointment_service();

-- 4. Make service_id nullable to support SET NULL on parent delete
ALTER TABLE public.appointments ALTER COLUMN service_id DROP NOT NULL;

-- 5. Recreate FK with ON DELETE SET NULL
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 6. consultation_responses.service_id: already nullable, recreate FK with SET NULL
ALTER TABLE public.consultation_responses DROP CONSTRAINT IF EXISTS consultation_responses_service_id_fkey;
ALTER TABLE public.consultation_responses
  ADD CONSTRAINT consultation_responses_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
