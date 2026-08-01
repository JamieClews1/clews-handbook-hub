-- 1. Finance role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';

-- helper that avoids referencing the new enum label directly (text compare)
CREATE OR REPLACE FUNCTION public.is_finance_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','finance')
  ) OR public.is_management(_user_id);
$$;

-- 2. Customer finance details (separate table, keeps finance data permissioned apart)
CREATE TABLE public.customer_finance_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  finance_contact_name text,
  finance_contact_email text,
  finance_contact_phone text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_county text,
  billing_postcode text,
  billing_country text DEFAULT 'United Kingdom',
  vat_number text,
  po_required boolean NOT NULL DEFAULT false,
  payment_terms_days integer,
  accounting_provider text NOT NULL DEFAULT 'sage50',
  accounting_customer_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_finance_details TO authenticated;
GRANT ALL ON public.customer_finance_details TO service_role;
ALTER TABLE public.customer_finance_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage customer finance details"
  ON public.customer_finance_details FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE TRIGGER trg_cfd_updated_at BEFORE UPDATE ON public.customer_finance_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Finance settings (singleton)
CREATE TABLE public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  next_invoice_number integer NOT NULL DEFAULT 1,
  invoice_number_padding integer NOT NULL DEFAULT 5,
  default_payment_terms_days integer NOT NULL DEFAULT 30,
  default_vat_rate numeric NOT NULL DEFAULT 20,
  invoice_email_subject text NOT NULL DEFAULT 'Invoice {{invoice_number}} from {{company_name}}',
  invoice_email_body text NOT NULL DEFAULT E'Dear {{finance_contact_name}},\n\nPlease find attached invoice {{invoice_number}} dated {{issue_date}} for the amount of {{total}}.\n\nPayment is due by {{due_date}}.\n\nIf you have any questions regarding this invoice, please reply to this email.\n\nKind regards,\n{{company_name}}',
  reminder_email_subject text NOT NULL DEFAULT 'Overdue invoice {{invoice_number}} - {{days_overdue}} days',
  reminder_email_body text NOT NULL DEFAULT E'Dear {{finance_contact_name}},\n\nOur records show invoice {{invoice_number}} for {{total}} was due on {{due_date}} and remains unpaid ({{days_overdue}} days overdue).\n\nIf payment has already been sent, please ignore this message.\n\nKind regards,\n{{company_name}}',
  reminder_days integer[] NOT NULL DEFAULT ARRAY[7,14,30],
  reminders_enabled boolean NOT NULL DEFAULT false,
  accounting_provider text NOT NULL DEFAULT 'sage50',
  accounting_sync_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage finance settings"
  ON public.finance_settings FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE TRIGGER trg_fs_updated_at BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.finance_settings DEFAULT VALUES;

-- 4. Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  job_number text,
  job_source text,
  load_report_id uuid,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + 30),
  currency text NOT NULL DEFAULT 'GBP',
  purchase_order text,
  net_total numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  -- snapshot of billing details at time of issue
  bill_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  sent_at timestamptz,
  sent_to text,
  send_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  last_reminder_day integer,
  -- accounting integration
  accounting_provider text NOT NULL DEFAULT 'sage50',
  accounting_ref text,
  accounting_synced_at timestamptz,
  accounting_sync_status text NOT NULL DEFAULT 'not_synced',
  status_override boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_chk CHECK (status IN ('draft','unpaid','partially_paid','paid','overdue','cancelled')),
  CONSTRAINT invoices_sync_status_chk CHECK (accounting_sync_status IN ('not_synced','pending','synced','error'))
);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_job_number ON public.invoices(job_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE POLICY "Portal users view their own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_portal_memberships m
    WHERE m.customer_id = invoices.customer_id AND m.user_id = auth.uid()
  ) AND status <> 'draft');
CREATE TRIGGER trg_inv_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Line items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  vat_amount numeric NOT NULL DEFAULT 0,
  nominal_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage invoice lines"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE POLICY "Portal users view their own invoice lines"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.customer_portal_memberships m ON m.customer_id = i.customer_id
    WHERE i.id = invoice_line_items.invoice_id AND m.user_id = auth.uid() AND i.status <> 'draft'
  ));
CREATE TRIGGER trg_ili_updated_at BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Payments
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  source text NOT NULL DEFAULT 'manual',
  accounting_ref text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage invoice payments"
  ON public.invoice_payments FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE TRIGGER trg_ip_updated_at BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Accounting sync log
CREATE TABLE public.accounting_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'sage50',
  direction text NOT NULL DEFAULT 'push',
  entity_type text NOT NULL DEFAULT 'invoice',
  entity_id uuid,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  payload jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asl_status_chk CHECK (status IN ('pending','success','error'))
);
CREATE INDEX idx_asl_status ON public.accounting_sync_log(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_sync_log TO authenticated;
GRANT ALL ON public.accounting_sync_log TO service_role;
ALTER TABLE public.accounting_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage sync log"
  ON public.accounting_sync_log FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));
CREATE TRIGGER trg_asl_updated_at BEFORE UPDATE ON public.accounting_sync_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Sequential invoice number allocator
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.finance_settings%ROWTYPE;
  n integer;
BEGIN
  SELECT * INTO s FROM public.finance_settings ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.finance_settings DEFAULT VALUES RETURNING * INTO s;
  END IF;
  n := s.next_invoice_number;
  UPDATE public.finance_settings SET next_invoice_number = n + 1 WHERE id = s.id;
  RETURN s.invoice_prefix || LPAD(n::text, s.invoice_number_padding, '0');
END;
$$;

-- 9. Keep invoice status/amount_paid in step with payments
CREATE OR REPLACE FUNCTION public.recalc_invoice_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  paid numeric;
  new_status text;
BEGIN
  SELECT * INTO inv FROM public.invoices
   WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid
    FROM public.invoice_payments WHERE invoice_id = inv.id;

  IF inv.status IN ('draft','cancelled') OR inv.status_override THEN
    UPDATE public.invoices SET amount_paid = paid WHERE id = inv.id;
    RETURN NULL;
  END IF;

  IF paid >= inv.gross_total AND inv.gross_total > 0 THEN
    new_status := 'paid';
  ELSIF paid > 0 THEN
    new_status := 'partially_paid';
  ELSIF inv.due_date < CURRENT_DATE THEN
    new_status := 'overdue';
  ELSE
    new_status := 'unpaid';
  END IF;

  UPDATE public.invoices SET amount_paid = paid, status = new_status WHERE id = inv.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalc_invoice_payments
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_payment_status();