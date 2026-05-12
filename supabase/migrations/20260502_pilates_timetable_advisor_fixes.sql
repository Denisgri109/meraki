CREATE INDEX IF NOT EXISTS idx_pilates_class_sessions_host_id ON public.pilates_class_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_pilates_hosts_profile_id ON public.pilates_hosts(profile_id);
CREATE INDEX IF NOT EXISTS idx_pilates_schedule_templates_host_id ON public.pilates_schedule_templates(host_id);
CREATE INDEX IF NOT EXISTS idx_pilates_schedule_templates_owner_id ON public.pilates_schedule_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_pilates_schedule_templates_service_id ON public.pilates_schedule_templates(service_id);
CREATE INDEX IF NOT EXISTS idx_pilates_session_bookings_client_id ON public.pilates_session_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_pilates_settings_owner_id ON public.pilates_settings(owner_id);

REVOKE EXECUTE ON FUNCTION public.prevent_non_owner_pilates_service() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.book_pilates_session(uuid, text, text, text, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_pilates_sessions(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_pilates_session(uuid, text, text, text, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_pilates_sessions(uuid, date, date) TO authenticated;

DROP POLICY IF EXISTS "Owners can manage Pilates settings" ON public.pilates_settings;
DROP POLICY IF EXISTS "Owners can insert Pilates settings" ON public.pilates_settings;
DROP POLICY IF EXISTS "Owners can update Pilates settings" ON public.pilates_settings;
DROP POLICY IF EXISTS "Owners can delete Pilates settings" ON public.pilates_settings;
CREATE POLICY "Owners can insert Pilates settings"
  ON public.pilates_settings FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can update Pilates settings"
  ON public.pilates_settings FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can delete Pilates settings"
  ON public.pilates_settings FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));

DROP POLICY IF EXISTS "Owners can manage Pilates hosts" ON public.pilates_hosts;
DROP POLICY IF EXISTS "Owners can insert Pilates hosts" ON public.pilates_hosts;
DROP POLICY IF EXISTS "Owners can update Pilates hosts" ON public.pilates_hosts;
DROP POLICY IF EXISTS "Owners can delete Pilates hosts" ON public.pilates_hosts;
CREATE POLICY "Owners can insert Pilates hosts"
  ON public.pilates_hosts FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can update Pilates hosts"
  ON public.pilates_hosts FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can delete Pilates hosts"
  ON public.pilates_hosts FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can view Pilates templates" ON public.pilates_schedule_templates;
CREATE POLICY "Authenticated users can view Pilates templates"
  ON public.pilates_schedule_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR owner_id = (select auth.uid()));
DROP POLICY IF EXISTS "Owners can manage Pilates templates" ON public.pilates_schedule_templates;
DROP POLICY IF EXISTS "Owners can insert Pilates templates" ON public.pilates_schedule_templates;
DROP POLICY IF EXISTS "Owners can update Pilates templates" ON public.pilates_schedule_templates;
DROP POLICY IF EXISTS "Owners can delete Pilates templates" ON public.pilates_schedule_templates;
CREATE POLICY "Owners can insert Pilates templates"
  ON public.pilates_schedule_templates FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can update Pilates templates"
  ON public.pilates_schedule_templates FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can delete Pilates templates"
  ON public.pilates_schedule_templates FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can view Pilates sessions" ON public.pilates_class_sessions;
CREATE POLICY "Authenticated users can view Pilates sessions"
  ON public.pilates_class_sessions FOR SELECT
  TO authenticated
  USING (status = 'scheduled' OR owner_id = (select auth.uid()));
DROP POLICY IF EXISTS "Owners can manage Pilates sessions" ON public.pilates_class_sessions;
DROP POLICY IF EXISTS "Owners can insert Pilates sessions" ON public.pilates_class_sessions;
DROP POLICY IF EXISTS "Owners can update Pilates sessions" ON public.pilates_class_sessions;
DROP POLICY IF EXISTS "Owners can delete Pilates sessions" ON public.pilates_class_sessions;
CREATE POLICY "Owners can insert Pilates sessions"
  ON public.pilates_class_sessions FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can update Pilates sessions"
  ON public.pilates_class_sessions FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));
CREATE POLICY "Owners can delete Pilates sessions"
  ON public.pilates_class_sessions FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()) AND public.is_owner_user((select auth.uid())));

DROP POLICY IF EXISTS "Users can view own Pilates bookings" ON public.pilates_session_bookings;
CREATE POLICY "Users can view own Pilates bookings"
  ON public.pilates_session_bookings FOR SELECT
  TO authenticated
  USING (
    client_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pilates_class_sessions s
      WHERE s.id = session_id AND s.owner_id = (select auth.uid())
    )
  );
