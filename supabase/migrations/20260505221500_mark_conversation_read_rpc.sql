-- Allow a conversation participant to mark the OTHER participant's
-- unread messages as read. The existing RLS update policy only lets a
-- sender edit their own messages, which means recipients could never
-- flip is_read=true and the navbar/inbox unread badges would stay stale.
-- We expose a tightly-scoped SECURITY DEFINER function that:
--   * verifies the caller is one of the conversation's two participants
--   * only updates messages where sender_id <> caller AND is_read = false
--   * touches only is_read / read_at columns
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_member boolean;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (c.client_id = v_uid OR c.master_id = v_uid)
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'not a participant of conversation %', p_conversation_id;
  END IF;

  UPDATE public.messages
     SET is_read = true,
         read_at = COALESCE(read_at, now())
   WHERE conversation_id = p_conversation_id
     AND sender_id <> v_uid
     AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
