-- 1. Several weigh tickets per RouteOne job
CREATE TABLE public.route_one_job_weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.route_one_jobs(id) ON DELETE CASCADE,
  weighbridge_transaction_id uuid NOT NULL UNIQUE REFERENCES public.weighbridge_transactions(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_one_job_weighings_job_idx ON public.route_one_job_weighings(job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_job_weighings TO authenticated;
GRANT ALL ON public.route_one_job_weighings TO service_role;
ALTER TABLE public.route_one_job_weighings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage job weighings" ON public.route_one_job_weighings
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.route_one_job_weighings (job_id, weighbridge_transaction_id, created_by)
SELECT j.id, j.weighbridge_transaction_id, NULL FROM public.route_one_jobs j
WHERE j.weighbridge_transaction_id IS NOT NULL
ON CONFLICT (weighbridge_transaction_id) DO NOTHING;

-- Weighing is its own state; it never overwrites the driver's completion
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS weighed_at timestamptz;

-- 2. Invoices remember the job / ticket they came from, so nothing is billed twice
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source_job_id uuid REFERENCES public.route_one_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source_transaction_id uuid REFERENCES public.weighbridge_transactions(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS zero_price_reason text;
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS source_transaction_id uuid REFERENCES public.weighbridge_transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_job ON public.invoices(source_job_id) WHERE source_job_id IS NOT NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_ticket ON public.invoices(source_transaction_id) WHERE source_transaction_id IS NOT NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS invoice_lines_one_per_ticket ON public.invoice_line_items(source_transaction_id) WHERE source_transaction_id IS NOT NULL;

-- 3. Atomic invoice creation: header + lines in one go, duplicates rejected
CREATE OR REPLACE FUNCTION public.create_invoice_with_lines(_header jsonb, _lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inv_id uuid; existing uuid; net numeric := 0; vat numeric := 0; l jsonb; i int := 0;
  src_job uuid := nullif(_header->>'source_job_id','')::uuid;
  src_tx uuid := nullif(_header->>'source_transaction_id','')::uuid;
BEGIN
  IF NOT public.is_finance_user(auth.uid()) THEN RAISE EXCEPTION 'Only finance staff can create invoices' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Add at least one line'; END IF;
  IF src_job IS NOT NULL THEN
    SELECT id INTO existing FROM public.invoices WHERE source_job_id = src_job AND status <> 'cancelled' LIMIT 1;
  END IF;
  IF existing IS NULL AND src_tx IS NOT NULL THEN
    SELECT id INTO existing FROM public.invoices WHERE source_transaction_id = src_tx AND status <> 'cancelled' LIMIT 1;
  END IF;
  IF existing IS NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(_lines) x JOIN public.invoice_line_items li ON li.source_transaction_id = nullif(x->>'source_transaction_id','')::uuid
    JOIN public.invoices iv ON iv.id = li.invoice_id AND iv.status <> 'cancelled') THEN
    RAISE EXCEPTION 'A weigh ticket on this job has already been invoiced';
  END IF;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    net := net + round(coalesce((l->>'net_amount')::numeric,0),2);
    vat := vat + round(coalesce((l->>'vat_amount')::numeric,0),2);
  END LOOP;
  IF net <= 0 AND nullif(btrim(_header->>'zero_price_reason'),'') IS NULL THEN
    RAISE EXCEPTION 'Enter a reason for a zero-value invoice';
  END IF;

  INSERT INTO public.invoices (invoice_number, customer_id, site_id, job_number, job_source, status, issue_date, due_date,
    purchase_order, notes, net_total, vat_total, gross_total, bill_to, accounting_provider, created_by,
    source_job_id, source_transaction_id, zero_price_reason)
  VALUES (public.next_invoice_number(), (_header->>'customer_id')::uuid, nullif(_header->>'site_id','')::uuid,
    _header->>'job_number', _header->>'job_source', 'draft', (_header->>'issue_date')::date, (_header->>'due_date')::date,
    nullif(btrim(_header->>'purchase_order'),''), nullif(btrim(_header->>'notes'),''), net, vat, net + vat,
    coalesce(_header->'bill_to','{}'::jsonb), coalesce(_header->>'accounting_provider','sage50'), auth.uid(),
    src_job, src_tx, nullif(btrim(_header->>'zero_price_reason'),''))
  RETURNING id INTO inv_id;

  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    INSERT INTO public.invoice_line_items (invoice_id, sort_order, description, quantity, unit, unit_price, net_amount, vat_rate, vat_amount, nominal_code, source_transaction_id)
    VALUES (inv_id, i, l->>'description', coalesce((l->>'quantity')::numeric,1), nullif(l->>'unit',''), coalesce((l->>'unit_price')::numeric,0),
      round(coalesce((l->>'net_amount')::numeric,0),2), coalesce((l->>'vat_rate')::numeric,20), round(coalesce((l->>'vat_amount')::numeric,0),2),
      nullif(l->>'nominal_code',''), nullif(l->>'source_transaction_id','')::uuid);
    i := i + 1;
  END LOOP;
  RETURN inv_id;
END $$;
REVOKE ALL ON FUNCTION public.create_invoice_with_lines(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines(jsonb, jsonb) TO authenticated, service_role;

-- 4. A completed weigh needs both weights and a non-negative net
CREATE OR REPLACE FUNCTION public.validate_weighbridge_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    IF coalesce(NEW.gross_weight_kg,0) <= 0 OR coalesce(NEW.tare_weight_kg,0) <= 0 THEN
      RAISE EXCEPTION 'Both weights are needed to complete the ticket' USING ERRCODE='23514';
    END IF;
    IF NEW.net_weight_kg IS NULL OR NEW.net_weight_kg < 0 THEN
      RAISE EXCEPTION 'Net weight cannot be negative' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER weighbridge_validate_completion BEFORE INSERT OR UPDATE OF status, gross_weight_kg, tare_weight_kg, net_weight_kg
  ON public.weighbridge_transactions FOR EACH ROW EXECUTE FUNCTION public.validate_weighbridge_completion();