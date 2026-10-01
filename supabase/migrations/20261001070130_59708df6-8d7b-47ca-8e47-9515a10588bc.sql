CREATE TABLE public.help_guides (
  id text PRIMARY KEY,
  content jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.help_guides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_guides TO authenticated;
CREATE POLICY "Staff read help guides" ON public.help_guides FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert help guides" ON public.help_guides FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update help guides" ON public.help_guides FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete help guides" ON public.help_guides FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));