
ALTER TABLE public.crm_tickets
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS crm_tickets_customer_idx ON public.crm_tickets(customer_id);

CREATE TABLE IF NOT EXISTS public.crm_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.crm_ticket_messages(id) ON DELETE CASCADE,
  graph_attachment_id text,
  file_name text NOT NULL,
  content_type text,
  size_bytes integer,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_ticket_attachments TO authenticated;
GRANT ALL ON public.crm_ticket_attachments TO service_role;

ALTER TABLE public.crm_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage ticket attachments"
  ON public.crm_ticket_attachments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crm_ticket_attachments_updated
  BEFORE UPDATE ON public.crm_ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS crm_ticket_attachments_ticket_idx ON public.crm_ticket_attachments(ticket_id);

CREATE OR REPLACE FUNCTION public.crm_match_customer_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH e AS (
    SELECT lower(btrim(_email)) AS addr,
           lower(split_part(btrim(_email), '@', 2)) AS domain
  )
  SELECT id FROM (
    -- exact contact email
    SELECT cc.customer_id AS id, 1 AS rank
    FROM public.customer_contacts cc, e
    WHERE lower(btrim(cc.email)) = e.addr AND e.addr <> ''
    UNION ALL
    -- exact finance contact email
    SELECT cf.customer_id, 2
    FROM public.customer_finance_details cf, e
    WHERE lower(btrim(cf.finance_contact_email)) = e.addr AND e.addr <> ''
    UNION ALL
    -- same email domain on a contact (ignoring common consumer domains)
    SELECT cc.customer_id, 3
    FROM public.customer_contacts cc, e
    WHERE e.domain <> ''
      AND e.domain NOT IN ('gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.co.uk','icloud.com','live.co.uk','btinternet.com','aol.com','me.com','msn.com')
      AND lower(split_part(btrim(cc.email), '@', 2)) = e.domain
  ) m
  ORDER BY rank
  LIMIT 1;
$$;
