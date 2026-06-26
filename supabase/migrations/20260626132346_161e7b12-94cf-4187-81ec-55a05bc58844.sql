CREATE TABLE public.rebate_report_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'generated',
  rebate_amount numeric,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamp with time zone,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamp with time zone,
  recipient_email text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rebate_report_tracking TO authenticated;
GRANT ALL ON public.rebate_report_tracking TO service_role;

ALTER TABLE public.rebate_report_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management and admins can view rebate tracking"
ON public.rebate_report_tracking FOR SELECT TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management and admins can insert rebate tracking"
ON public.rebate_report_tracking FOR INSERT TO authenticated
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management and admins can update rebate tracking"
ON public.rebate_report_tracking FOR UPDATE TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management and admins can delete rebate tracking"
ON public.rebate_report_tracking FOR DELETE TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX rebate_report_tracking_site_period_idx
ON public.rebate_report_tracking (customer_id, site_id, period_start)
WHERE site_id IS NOT NULL;

CREATE UNIQUE INDEX rebate_report_tracking_customer_period_idx
ON public.rebate_report_tracking (customer_id, period_start)
WHERE site_id IS NULL;

CREATE INDEX rebate_report_tracking_period_idx
ON public.rebate_report_tracking (period_start);

CREATE TRIGGER update_rebate_report_tracking_updated_at
BEFORE UPDATE ON public.rebate_report_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();