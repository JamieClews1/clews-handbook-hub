CREATE TABLE public.ewc_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  chapter text NOT NULL,
  chapter_name text NOT NULL,
  sub_chapter text NOT NULL,
  sub_chapter_name text NOT NULL,
  hazardous boolean NOT NULL DEFAULT false,
  is_common boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ewc_codes TO authenticated;
GRANT ALL ON public.ewc_codes TO service_role;
ALTER TABLE public.ewc_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view EWC codes" ON public.ewc_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage EWC codes" ON public.ewc_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));

CREATE TABLE public.sic_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  section text NOT NULL,
  section_name text NOT NULL,
  is_common boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sic_codes TO authenticated;
GRANT ALL ON public.sic_codes TO service_role;
ALTER TABLE public.sic_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view SIC codes" ON public.sic_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage SIC codes" ON public.sic_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));

CREATE INDEX idx_ewc_codes_code ON public.ewc_codes (code);
CREATE INDEX idx_sic_codes_code ON public.sic_codes (code);

CREATE TRIGGER update_ewc_codes_updated_at BEFORE UPDATE ON public.ewc_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sic_codes_updated_at BEFORE UPDATE ON public.sic_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();