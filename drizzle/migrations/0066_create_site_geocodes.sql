CREATE TABLE public.site_geocodes (
  postcode text PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  label text,
  location_type text,
  status text NOT NULL DEFAULT 'ok',
  attempts integer NOT NULL DEFAULT 1,
  geocoded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_geocodes TO authenticated;
GRANT ALL ON public.site_geocodes TO service_role;

ALTER TABLE public.site_geocodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read site geocodes"
  ON public.site_geocodes
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));