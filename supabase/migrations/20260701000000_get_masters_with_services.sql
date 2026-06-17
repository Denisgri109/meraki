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
) LANGUAGE sql SECURITY INVOKER AS $$
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
