CREATE TABLE public.portal_view_as_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  customer_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.portal_view_as_log TO authenticated;
GRANT ALL ON public.portal_view_as_log TO service_role;
ALTER TABLE public.portal_view_as_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins log their own views" ON public.portal_view_as_log FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read view log" ON public.portal_view_as_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));