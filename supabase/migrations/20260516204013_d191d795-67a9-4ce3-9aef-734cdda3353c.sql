
CREATE TABLE public.data_hub_jobs_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid,
  job_number text NOT NULL,
  source text NOT NULL,
  job_date date,
  customer text,
  site text,
  ewc text,
  waste_description text,
  category text,
  movement_type text,
  container_type text,
  weight_t numeric,
  vehicle_registration text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_number_override text,
  job_type text,
  driver text,
  tipping_location text,
  manual_edit_note text,
  original_created_at timestamptz,
  original_updated_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  archive_reason text
);

CREATE INDEX idx_data_hub_jobs_archive_source ON public.data_hub_jobs_archive(source);
CREATE INDEX idx_data_hub_jobs_archive_archived_at ON public.data_hub_jobs_archive(archived_at DESC);
CREATE INDEX idx_data_hub_jobs_archive_job_number ON public.data_hub_jobs_archive(job_number);

ALTER TABLE public.data_hub_jobs_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management/admin can read archive"
  ON public.data_hub_jobs_archive FOR SELECT
  TO authenticated
  USING (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management/admin can insert archive"
  ON public.data_hub_jobs_archive FOR INSERT
  TO authenticated
  WITH CHECK (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management/admin can delete archive"
  ON public.data_hub_jobs_archive FOR DELETE
  TO authenticated
  USING (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
