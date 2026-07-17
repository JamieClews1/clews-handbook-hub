CREATE TABLE IF NOT EXISTS public.dwt_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  ticket_number TEXT,
  wt_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  environment TEXT,
  request_payload JSONB,
  response_body JSONB,
  http_status INTEGER,
  error_message TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dwt_submissions_job_id_idx ON public.dwt_submissions(job_id);
CREATE INDEX IF NOT EXISTS dwt_submissions_submitted_at_idx ON public.dwt_submissions(submitted_at DESC);

GRANT SELECT, INSERT ON public.dwt_submissions TO authenticated;
GRANT ALL ON public.dwt_submissions TO service_role;

ALTER TABLE public.dwt_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view DWT submissions"
  ON public.dwt_submissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert DWT submissions"
  ON public.dwt_submissions FOR INSERT TO authenticated WITH CHECK (true);