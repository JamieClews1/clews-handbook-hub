CREATE TABLE public.load_report_exclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT,
  excluded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (job_number, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_report_exclusions TO authenticated;
GRANT ALL ON public.load_report_exclusions TO service_role;

ALTER TABLE public.load_report_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view load report exclusions"
  ON public.load_report_exclusions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create load report exclusions"
  ON public.load_report_exclusions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete load report exclusions"
  ON public.load_report_exclusions FOR DELETE
  USING (auth.uid() IS NOT NULL);