CREATE TABLE public.data_hub_void_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  source text NOT NULL,
  reason text,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_number, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_hub_void_jobs TO authenticated;
GRANT ALL ON public.data_hub_void_jobs TO service_role;

ALTER TABLE public.data_hub_void_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view void jobs" ON public.data_hub_void_jobs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and management manage void jobs" ON public.data_hub_void_jobs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE INDEX idx_data_hub_void_jobs_source ON public.data_hub_void_jobs (source, job_number);