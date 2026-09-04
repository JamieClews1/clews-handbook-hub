CREATE TABLE public.container_load_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid REFERENCES public.container_loads(id) ON DELETE SET NULL,
  reference text,
  load_name text,
  to_email text NOT NULL,
  cc_email text,
  reply_to_email text,
  subject text,
  body text,
  attachment_count integer NOT NULL DEFAULT 0,
  attachment_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_load_send_log TO authenticated;
GRANT ALL ON public.container_load_send_log TO service_role;

ALTER TABLE public.container_load_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view container send history"
ON public.container_load_send_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can add container send history"
ON public.container_load_send_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_container_load_send_log_created_at ON public.container_load_send_log (created_at DESC);
CREATE INDEX idx_container_load_send_log_load ON public.container_load_send_log (load_id);