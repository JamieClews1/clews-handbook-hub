ALTER TABLE public.colas_consignments
  ADD COLUMN IF NOT EXISTS auto_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_evidence text;

CREATE TABLE public.colas_consignment_scan_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  paused_reason text,
  lease_until timestamptz,
  last_run_at timestamptz,
  last_run_trigger text,
  last_run_summary jsonb,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.colas_consignment_scan_state TO authenticated;
GRANT ALL ON public.colas_consignment_scan_state TO service_role;
ALTER TABLE public.colas_consignment_scan_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas scan state" ON public.colas_consignment_scan_state FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));
INSERT INTO public.colas_consignment_scan_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.colas_consignment_scan_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  document_id uuid NOT NULL,
  file_name text,
  result text NOT NULL CHECK (result IN ('found', 'unreadable', 'not_present')),
  consignment_ref text,
  evidence text,
  applied text NOT NULL CHECK (applied IN ('saved', 'flagged', 'kept_existing')),
  run_trigger text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_number, document_id)
);
CREATE INDEX colas_consignment_scan_attempts_created_idx ON public.colas_consignment_scan_attempts (created_at DESC);
GRANT SELECT ON public.colas_consignment_scan_attempts TO authenticated;
GRANT ALL ON public.colas_consignment_scan_attempts TO service_role;
ALTER TABLE public.colas_consignment_scan_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read colas scan attempts" ON public.colas_consignment_scan_attempts FOR SELECT TO authenticated USING ((SELECT public.is_staff(auth.uid())));

-- Single-flight lease so two runs never read the same scans at once.
CREATE OR REPLACE FUNCTION public.colas_scan_claim(_seconds integer)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    UPDATE public.colas_consignment_scan_state
       SET lease_until = now() + make_interval(secs => _seconds), updated_at = now()
     WHERE id = 1 AND (lease_until IS NULL OR lease_until < now())
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$$;
REVOKE ALL ON FUNCTION public.colas_scan_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.colas_scan_claim(integer) TO service_role;