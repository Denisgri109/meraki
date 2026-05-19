-- Fix QR RPCs that referenced non-existent columns (owner_id/token/total_scans/last_scanned_at).
-- Real schema for public.loyalty_qr_codes: id, user_id, code, points_value, is_active, scans_count, created_at, updated_at.

CREATE OR REPLACE FUNCTION public.ensure_loyalty_qr_code(p_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, code text, points_value integer, scans_count integer, is_active boolean, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.loyalty_qr_codes q WHERE q.user_id = p_user_id) THEN
    LOOP
      v_code := encode(extensions.gen_random_bytes(16), 'hex');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.loyalty_qr_codes q WHERE q.code = v_code);
    END LOOP;

    INSERT INTO public.loyalty_qr_codes (user_id, code, points_value, is_active)
    VALUES (p_user_id, v_code, 50, true);
  END IF;

  RETURN QUERY
  SELECT q.id, q.user_id, q.code, q.points_value, q.scans_count, q.is_active, q.updated_at
  FROM public.loyalty_qr_codes q
  WHERE q.user_id = p_user_id
  ORDER BY q.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_loyalty_qr_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_loyalty_qr_code(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.regenerate_loyalty_qr_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  LOOP
    v_code := encode(extensions.gen_random_bytes(16), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.loyalty_qr_codes q WHERE q.code = v_code);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.loyalty_qr_codes q WHERE q.user_id = p_user_id) THEN
    UPDATE public.loyalty_qr_codes
    SET code = v_code, updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.loyalty_qr_codes (user_id, code, points_value, is_active)
    VALUES (p_user_id, v_code, 50, true);
  END IF;

  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_loyalty_qr_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_loyalty_qr_code(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.set_loyalty_qr_points_value(p_user_id uuid, p_points integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_code text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_points IS NULL OR p_points < 1 OR p_points > 10000 THEN
    RAISE EXCEPTION 'Points must be between 1 and 10000';
  END IF;

  SELECT id INTO v_existing_id FROM public.loyalty_qr_codes WHERE user_id = p_user_id LIMIT 1;

  IF v_existing_id IS NULL THEN
    LOOP
      v_code := encode(extensions.gen_random_bytes(16), 'hex');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.loyalty_qr_codes q WHERE q.code = v_code);
    END LOOP;
    INSERT INTO public.loyalty_qr_codes (user_id, code, points_value, is_active)
    VALUES (p_user_id, v_code, p_points, true);
  ELSE
    UPDATE public.loyalty_qr_codes
    SET points_value = p_points, updated_at = now()
    WHERE id = v_existing_id;
  END IF;

  RETURN p_points;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_loyalty_qr_points_value(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_loyalty_qr_points_value(uuid, integer) TO authenticated;


-- Drop the broken stubs that reference non-existent columns
DROP FUNCTION IF EXISTS public.get_or_create_qr_code(uuid);
DROP FUNCTION IF EXISTS public.regenerate_qr_token(uuid);
DROP FUNCTION IF EXISTS public.scan_loyalty_qr(text, uuid);
DROP FUNCTION IF EXISTS public.get_my_qr_code();
