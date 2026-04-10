
CREATE TABLE public.locked_rebate_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'site_rebate',
  locked_by UUID,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  report_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rebate_values_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_rebate NUMERIC DEFAULT 0,
  total_weight NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(site_id, period_start, period_end, report_type)
);

ALTER TABLE public.locked_rebate_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view locked reports"
  ON public.locked_rebate_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create locked reports"
  ON public.locked_rebate_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update locked reports"
  ON public.locked_rebate_reports FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete locked reports"
  ON public.locked_rebate_reports FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_locked_rebate_reports_updated_at
  BEFORE UPDATE ON public.locked_rebate_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
