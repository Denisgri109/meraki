-- Trigger to delete future sessions with no active bookings when a schedule template is deleted
CREATE OR REPLACE FUNCTION public.on_pilates_template_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.pilates_class_sessions
  WHERE template_id = OLD.id
    AND starts_at >= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.pilates_session_bookings b
      WHERE b.session_id = public.pilates_class_sessions.id
        AND b.status = 'booked'
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_delete_pilates_template_sessions ON public.pilates_schedule_templates;
CREATE TRIGGER trigger_delete_pilates_template_sessions
  BEFORE DELETE ON public.pilates_schedule_templates
  FOR EACH ROW EXECUTE FUNCTION public.on_pilates_template_deleted();

-- Clean up existing orphaned future sessions that resulted from previously deleted templates
DELETE FROM public.pilates_class_sessions
WHERE template_id IS NULL
  AND is_override = false
  AND starts_at >= now()
  AND NOT EXISTS (
    SELECT 1 FROM public.pilates_session_bookings b
    WHERE b.session_id = public.pilates_class_sessions.id
      AND b.status = 'booked'
  );
