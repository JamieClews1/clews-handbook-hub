
-- ============================================
-- CONTAMINATIONS PORTAL - Full Schema
-- ============================================

-- 1. Contamination Queries (main tracking table)
CREATE TABLE public.contamination_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL,
  customer TEXT,
  site TEXT,
  postcode TEXT,
  order_number TEXT,
  query_reason TEXT,
  initial_cost NUMERIC,
  charge_amount NUMERIC,
  contamination_type TEXT,
  container_type TEXT,
  waste_description TEXT,
  weight_t NUMERIC,
  job_date DATE,
  vehicle_reg TEXT,
  owner_id UUID,
  owner_name TEXT,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'query',
  data_hub_job_id UUID,
  photos TEXT[] DEFAULT '{}',
  email_sent_at TIMESTAMPTZ,
  po_number TEXT,
  resolved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contamination_queries ENABLE ROW LEVEL SECURITY;

-- Staff (admin/management) can do everything
CREATE POLICY "Admin/management can manage contamination queries"
ON public.contamination_queries FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- All authenticated staff can view
CREATE POLICY "Authenticated users can view contamination queries"
ON public.contamination_queries FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_contamination_queries_updated_at
BEFORE UPDATE ON public.contamination_queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Activity Log (audit trail)
CREATE TABLE public.contamination_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.contamination_queries(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  action_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contamination_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/management can manage contamination activity log"
ON public.contamination_activity_log FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Authenticated users can view contamination activity log"
ON public.contamination_activity_log FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Charge Matrix (configurable contamination charges)
CREATE TABLE public.contamination_charge_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contamination_type TEXT NOT NULL,
  charge_value NUMERIC NOT NULL DEFAULT 0,
  description_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contamination_charge_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage charge matrix"
ON public.contamination_charge_matrix FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view charge matrix"
ON public.contamination_charge_matrix FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_contamination_charge_matrix_updated_at
BEFORE UPDATE ON public.contamination_charge_matrix
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage bucket for contamination photos
INSERT INTO storage.buckets (id, name, public) VALUES ('contamination-photos', 'contamination-photos', true);

CREATE POLICY "Authenticated users can upload contamination photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contamination-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view contamination photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'contamination-photos');

CREATE POLICY "Admin/management can delete contamination photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'contamination-photos' AND (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid())));
