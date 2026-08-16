ALTER TABLE public.data_hub_jobs
  ADD COLUMN IF NOT EXISTS account_code text,
  ADD COLUMN IF NOT EXISTS haulier text,
  ADD COLUMN IF NOT EXISTS carrier_number text,
  ADD COLUMN IF NOT EXISTS gross_weight numeric,
  ADD COLUMN IF NOT EXISTS tare_weight numeric,
  ADD COLUMN IF NOT EXISTS linked_skip_job text;

CREATE INDEX IF NOT EXISTS idx_data_hub_jobs_linked_skip_job ON public.data_hub_jobs (linked_skip_job) WHERE linked_skip_job IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.midweigh_import_staging (
  ticket text PRIMARY KEY,
  job_date date,
  customer text,
  account_code text,
  ewc text,
  weight numeric,
  vehicle text,
  product text,
  haulier text,
  carrier_number text,
  gross_weight numeric,
  tare_weight numeric,
  in_out text,
  ewc_desc text,
  job_type text,
  container text,
  skip_job text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.midweigh_import_staging TO authenticated;
GRANT ALL ON public.midweigh_import_staging TO service_role;
ALTER TABLE public.midweigh_import_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage midweigh staging" ON public.midweigh_import_staging
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));