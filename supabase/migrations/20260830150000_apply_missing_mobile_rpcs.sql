-- ============================================================================
-- Apply two RPCs the mobile app calls but that were never applied to the live
-- database (2026-08-30)
--
-- Both have migration files in `meraki-MOBILE/supabase/migrations/` but neither
-- appears in `supabase_migrations.schema_migrations`, and neither function
-- exists in the live project. The app therefore fails at runtime:
--
--   * `get_masters_with_services` — DiscoverMastersScreen calls it to list
--     masters. Without it the screen cannot load at all.
--   * `update_lesson_durations`   — the Academy course/lesson screens call it
--     to batch-write lesson durations. CourseDetailScreen surfaces the error
--     to the user; AcademyHomeScreen swallows it, so durations silently never
--     save.
--
-- Bodies are copied verbatim from:
--   20260701000000_get_masters_with_services.sql
--   20260710000000_batch_update_lesson_durations.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_masters_with_services()
RETURNS TABLE (
    id uuid,
    full_name text,
    avatar_url text,
    city text,
    country text,
    state text,
    state_code text,
    latitude double precision,
    longitude double precision,
    bio text,
    is_visible_globally boolean,
    accepts_new_clients boolean,
    services_count bigint
) LANGUAGE sql SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT
        p.id,
        p.full_name,
        p.avatar_url,
        p.city,
        p.country,
        p.state,
        p.state_code,
        p.latitude,
        p.longitude,
        p.bio,
        COALESCE(ms.is_visible_globally, true) as is_visible_globally,
        COALESCE(ms.accepts_new_clients, true) as accepts_new_clients,
        COUNT(s.id) as services_count
    FROM profiles p
    LEFT JOIN master_settings ms ON p.id = ms.master_id
    LEFT JOIN master_services s ON p.id = s.master_id
    WHERE p.role IN ('master', 'owner') AND p.full_name IS NOT NULL
    GROUP BY p.id, ms.is_visible_globally, ms.accepts_new_clients;
$$;

REVOKE EXECUTE ON FUNCTION public.get_masters_with_services() FROM public;
GRANT EXECUTE ON FUNCTION public.get_masters_with_services() TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.update_lesson_durations(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    item jsonb;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(payload)
    LOOP
        UPDATE public.lessons
        SET duration_minutes = (item->>'duration_minutes')::int
        WHERE id = (item->>'id')::uuid;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_lesson_durations(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_lesson_durations(jsonb) TO authenticated, service_role;
