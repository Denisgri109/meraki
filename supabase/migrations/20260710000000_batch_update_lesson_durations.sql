CREATE OR REPLACE FUNCTION update_lesson_durations(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    item jsonb;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(payload)
    LOOP
        UPDATE lessons
        SET duration_minutes = (item->>'duration_minutes')::int
        WHERE id = (item->>'id')::uuid;
    END LOOP;
END;
$$;
