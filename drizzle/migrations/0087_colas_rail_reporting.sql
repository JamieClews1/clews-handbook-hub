
CREATE OR REPLACE FUNCTION public.colas_can_authorise(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.is_management(_user_id)
$$;

CREATE TABLE public.colas_manual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('enva','bm','fortress','other')),
  collection_date date NOT NULL,
  waste_stream text NOT NULL,
  waste_type text,
  hazardous boolean NOT NULL DEFAULT false,
  weight_kg numeric CHECK (weight_kg IS NULL OR weight_kg >= 0),
  weight_t numeric GENERATED ALWAYS AS (weight_kg / 1000.0) STORED,
  consignment_ref text,
  collection_reference text,
  location text,
  notes text,
  document_path text,
  document_name text,
  status text NOT NULL DEFAULT 'awaiting_paperwork' CHECK (status IN ('awaiting_paperwork','confirmed')),
  import_id uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX colas_manual_entries_date_idx ON public.colas_manual_entries (collection_date);
GRANT SELECT, INSERT, UPDATE ON public.colas_manual_entries TO authenticated;
GRANT ALL ON public.colas_manual_entries TO service_role;
ALTER TABLE public.colas_manual_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas entries" ON public.colas_manual_entries FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff add colas entries" ON public.colas_manual_entries FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff(auth.uid())) AND voided_at IS NULL);
CREATE POLICY "Staff edit colas entries" ON public.colas_manual_entries FOR UPDATE TO authenticated USING ((SELECT public.is_staff(auth.uid()))) WITH CHECK ((SELECT public.is_staff(auth.uid())) AND (voided_at IS NULL OR (SELECT public.colas_can_authorise(auth.uid()))));

CREATE TABLE public.colas_consignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  source text NOT NULL DEFAULT 'skiptrak',
  consignment_ref text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_number, source)
);
GRANT SELECT, INSERT, UPDATE ON public.colas_consignments TO authenticated;
GRANT ALL ON public.colas_consignments TO service_role;
ALTER TABLE public.colas_consignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas consignments" ON public.colas_consignments FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff add colas consignments" ON public.colas_consignments FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff edit colas consignments" ON public.colas_consignments FOR UPDATE TO authenticated USING ((SELECT public.is_staff(auth.uid()))) WITH CHECK ((SELECT public.is_staff(auth.uid())));

CREATE TABLE public.colas_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  category text NOT NULL CHECK (category IN ('hazardous','non_hazardous')),
  entry_type text NOT NULL CHECK (entry_type IN ('sage_import','adjustment')),
  amount_ex_vat numeric NOT NULL,
  original_amount numeric,
  source_file text,
  source_row jsonb,
  reason text,
  import_id uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (entry_type <> 'adjustment' OR coalesce(trim(reason),'') <> '')
);
CREATE INDEX colas_costs_period_idx ON public.colas_costs (year, month);
GRANT SELECT, INSERT, UPDATE ON public.colas_costs TO authenticated;
GRANT ALL ON public.colas_costs TO service_role;
ALTER TABLE public.colas_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas costs" ON public.colas_costs FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff import colas costs" ON public.colas_costs FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff(auth.uid())) AND voided_at IS NULL AND (entry_type = 'sage_import' OR (SELECT public.colas_can_authorise(auth.uid()))));
CREATE POLICY "Authorised void colas costs" ON public.colas_costs FOR UPDATE TO authenticated USING ((SELECT public.colas_can_authorise(auth.uid()))) WITH CHECK ((SELECT public.colas_can_authorise(auth.uid())));

CREATE TABLE public.colas_report_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  source_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  comments text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved')),
  approved_by uuid,
  approved_at timestamptz,
  outstanding_reason text,
  snapshot jsonb,
  last_generated_at timestamptz,
  last_generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
GRANT SELECT, INSERT, UPDATE ON public.colas_report_periods TO authenticated;
GRANT ALL ON public.colas_report_periods TO service_role;
ALTER TABLE public.colas_report_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas periods" ON public.colas_report_periods FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff add colas periods" ON public.colas_report_periods FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff(auth.uid())) AND status = 'open');
CREATE POLICY "Staff edit colas periods" ON public.colas_report_periods FOR UPDATE TO authenticated USING ((SELECT public.is_staff(auth.uid()))) WITH CHECK ((SELECT public.is_staff(auth.uid())));

CREATE OR REPLACE FUNCTION public.colas_guard_period_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.approved_by IS DISTINCT FROM OLD.approved_by)
     AND auth.uid() IS NOT NULL AND NOT public.colas_can_authorise(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators or management can approve or reopen a Colas Rail month';
  END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  ELSIF NEW.status = 'open' AND OLD.status = 'approved' THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER colas_guard_period_approval BEFORE UPDATE ON public.colas_report_periods FOR EACH ROW EXECUTE FUNCTION public.colas_guard_period_approval();

CREATE TABLE public.colas_opening_balances (
  year integer PRIMARY KEY,
  hazardous_t numeric NOT NULL DEFAULT 0,
  non_hazardous_t numeric NOT NULL DEFAULT 0,
  hazardous_cost numeric NOT NULL DEFAULT 0,
  non_hazardous_cost numeric NOT NULL DEFAULT 0,
  note text,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colas_opening_balances TO authenticated;
GRANT ALL ON public.colas_opening_balances TO service_role;
ALTER TABLE public.colas_opening_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas opening balances" ON public.colas_opening_balances FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Authorised manage colas opening balances" ON public.colas_opening_balances FOR ALL TO authenticated USING ((SELECT public.colas_can_authorise(auth.uid()))) WITH CHECK ((SELECT public.colas_can_authorise(auth.uid())));

CREATE TABLE public.colas_report_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  year_start_month integer NOT NULL DEFAULT 1 CHECK (year_start_month BETWEEN 1 AND 12),
  customer_access_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.colas_report_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.colas_report_settings TO authenticated;
GRANT ALL ON public.colas_report_settings TO service_role;
ALTER TABLE public.colas_report_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas settings" ON public.colas_report_settings FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Authorised edit colas settings" ON public.colas_report_settings FOR UPDATE TO authenticated USING ((SELECT public.colas_can_authorise(auth.uid()))) WITH CHECK ((SELECT public.colas_can_authorise(auth.uid())));

CREATE TABLE public.colas_import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  file_name text,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  rows_flagged integer NOT NULL DEFAULT 0,
  details jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.colas_import_log TO authenticated;
GRANT ALL ON public.colas_import_log TO service_role;
ALTER TABLE public.colas_import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas imports" ON public.colas_import_log FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff log colas imports" ON public.colas_import_log FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff(auth.uid())));

CREATE TABLE public.colas_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX colas_audit_log_changed_idx ON public.colas_audit_log (changed_at DESC);
GRANT SELECT ON public.colas_audit_log TO authenticated;
GRANT ALL ON public.colas_audit_log TO service_role;
ALTER TABLE public.colas_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas audit" ON public.colas_audit_log FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));

CREATE OR REPLACE FUNCTION public.colas_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb;
  oldrec jsonb;
  act text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  IF TG_OP <> 'INSERT' THEN oldrec := to_jsonb(OLD); END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (oldrec ->> 'voided_at') IS NULL AND (rec ->> 'voided_at') IS NOT NULL THEN act := 'void';
    ELSIF TG_TABLE_NAME = 'colas_report_periods' AND (oldrec ->> 'status') IS DISTINCT FROM (rec ->> 'status') THEN
      act := CASE WHEN rec ->> 'status' = 'approved' THEN 'approve' ELSE 'reopen' END;
    END IF;
  END IF;
  INSERT INTO public.colas_audit_log (table_name, record_id, action, old_row, new_row, changed_by)
  VALUES (TG_TABLE_NAME, coalesce(rec ->> 'id', rec ->> 'year'), act, oldrec,
          CASE WHEN TG_OP <> 'DELETE' THEN rec END, auth.uid());
  RETURN coalesce(NEW, OLD);
END $$;

CREATE TRIGGER colas_audit AFTER INSERT OR UPDATE OR DELETE ON public.colas_manual_entries FOR EACH ROW EXECUTE FUNCTION public.colas_audit();
CREATE TRIGGER colas_audit AFTER INSERT OR UPDATE OR DELETE ON public.colas_consignments FOR EACH ROW EXECUTE FUNCTION public.colas_audit();
CREATE TRIGGER colas_audit AFTER INSERT OR UPDATE OR DELETE ON public.colas_costs FOR EACH ROW EXECUTE FUNCTION public.colas_audit();
CREATE TRIGGER colas_audit AFTER INSERT OR UPDATE OR DELETE ON public.colas_report_periods FOR EACH ROW EXECUTE FUNCTION public.colas_audit();
CREATE TRIGGER colas_audit AFTER INSERT OR UPDATE OR DELETE ON public.colas_opening_balances FOR EACH ROW EXECUTE FUNCTION public.colas_audit();
CREATE TRIGGER colas_audit AFTER UPDATE ON public.colas_report_settings FOR EACH ROW EXECUTE FUNCTION public.colas_audit();

CREATE TRIGGER colas_manual_entries_updated BEFORE UPDATE ON public.colas_manual_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER colas_consignments_updated BEFORE UPDATE ON public.colas_consignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER colas_costs_updated BEFORE UPDATE ON public.colas_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff read colas documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'colas-documents' AND (SELECT public.is_staff(auth.uid())));
CREATE POLICY "Staff upload colas documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'colas-documents' AND (SELECT public.is_staff(auth.uid())));
