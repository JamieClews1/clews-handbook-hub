CREATE TABLE public.site_standing_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer text,
  site text NOT NULL,
  container_type text NOT NULL,
  ewc text NOT NULL DEFAULT '',
  bin_count integer NOT NULL DEFAULT 2 CHECK (bin_count >= 1 AND bin_count <= 20),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_standing_bins TO authenticated;
GRANT ALL ON public.site_standing_bins TO service_role;
ALTER TABLE public.site_standing_bins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage standing bins" ON public.site_standing_bins FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER site_standing_bins_updated BEFORE UPDATE ON public.site_standing_bins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();