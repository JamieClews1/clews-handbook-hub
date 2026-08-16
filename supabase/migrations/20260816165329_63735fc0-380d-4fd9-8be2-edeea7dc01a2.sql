CREATE TABLE public.midweigh_import_staging (
  job_number text PRIMARY KEY,
  job_date date,
  customer text,
  ewc text,
  waste_description text,
  category text,
  movement_type text,
  container_type text,
  weight_t numeric,
  vehicle_registration text,
  job_type text,
  account_code text,
  haulier text,
  carrier_number text,
  gross_weight numeric,
  tare_weight numeric,
  linked_skip_job text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.midweigh_import_staging TO authenticated;
GRANT ALL ON public.midweigh_import_staging TO service_role;

ALTER TABLE public.midweigh_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage midweigh import staging"
ON public.midweigh_import_staging
FOR ALL
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));