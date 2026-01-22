-- Data Hub unified jobs table
CREATE TABLE IF NOT EXISTS public.data_hub_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_hub_jobs_job_number_unique UNIQUE (job_number)
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_data_hub_jobs_job_date ON public.data_hub_jobs (job_date);
CREATE INDEX IF NOT EXISTS idx_data_hub_jobs_customer ON public.data_hub_jobs (customer);
CREATE INDEX IF NOT EXISTS idx_data_hub_jobs_ewc ON public.data_hub_jobs (ewc);

-- Keep updated_at current
DROP TRIGGER IF EXISTS trg_data_hub_jobs_updated_at ON public.data_hub_jobs;
CREATE TRIGGER trg_data_hub_jobs_updated_at
BEFORE UPDATE ON public.data_hub_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.data_hub_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: Management + Admin only
DROP POLICY IF EXISTS "Management/admin can read data hub jobs" ON public.data_hub_jobs;
CREATE POLICY "Management/admin can read data hub jobs"
ON public.data_hub_jobs
FOR SELECT
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Management/admin can insert data hub jobs" ON public.data_hub_jobs;
CREATE POLICY "Management/admin can insert data hub jobs"
ON public.data_hub_jobs
FOR INSERT
TO authenticated
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Management/admin can update data hub jobs" ON public.data_hub_jobs;
CREATE POLICY "Management/admin can update data hub jobs"
ON public.data_hub_jobs
FOR UPDATE
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Management/admin can delete data hub jobs" ON public.data_hub_jobs;
CREATE POLICY "Management/admin can delete data hub jobs"
ON public.data_hub_jobs
FOR DELETE
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
