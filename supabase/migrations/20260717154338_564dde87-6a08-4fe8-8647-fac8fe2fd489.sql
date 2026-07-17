CREATE TABLE public.dwt_job_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE REFERENCES public.data_hub_jobs(id) ON DELETE CASCADE,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dwt_job_overrides TO authenticated;
GRANT ALL ON public.dwt_job_overrides TO service_role;
ALTER TABLE public.dwt_job_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read dwt overrides" ON public.dwt_job_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert dwt overrides" ON public.dwt_job_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update dwt overrides" ON public.dwt_job_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_dwt_job_overrides_updated_at BEFORE UPDATE ON public.dwt_job_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();