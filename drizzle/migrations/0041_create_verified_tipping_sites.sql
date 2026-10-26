CREATE TABLE public.verified_tipping_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  operator_name text,
  registration_number text,
  register text NOT NULL DEFAULT 'waste-operations',
  facility_type text,
  address text,
  postcode text,
  status text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_name, postcode)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verified_tipping_sites TO authenticated;
GRANT ALL ON public.verified_tipping_sites TO service_role;

ALTER TABLE public.verified_tipping_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read verified tipping sites"
  ON public.verified_tipping_sites FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can add verified tipping sites"
  ON public.verified_tipping_sites FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update verified tipping sites"
  ON public.verified_tipping_sites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can delete verified tipping sites"
  ON public.verified_tipping_sites FOR DELETE TO authenticated USING (true);