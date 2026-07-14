CREATE TABLE public.portal_section_visibility (
  section_key TEXT PRIMARY KEY,
  hidden BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT ON public.portal_section_visibility TO authenticated, anon;
GRANT ALL ON public.portal_section_visibility TO service_role;
ALTER TABLE public.portal_section_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read section visibility"
  ON public.portal_section_visibility FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins manage section visibility"
  ON public.portal_section_visibility FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));