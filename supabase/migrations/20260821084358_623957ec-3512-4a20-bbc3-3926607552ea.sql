ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pod_email text,
  ADD COLUMN IF NOT EXISTS auto_pod_emails_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.customer_sites
  ADD COLUMN IF NOT EXISTS pod_email text;

CREATE TABLE IF NOT EXISTS public.pod_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  site text,
  recipient_email text NOT NULL,
  pod_count integer NOT NULL DEFAULT 0,
  pod_ids uuid[] NOT NULL DEFAULT '{}',
  digest_date date NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pod_email_logs TO authenticated;
GRANT ALL ON public.pod_email_logs TO service_role;
ALTER TABLE public.pod_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view POD email logs" ON public.pod_email_logs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pod_email_logs_digest_date ON public.pod_email_logs (digest_date DESC);