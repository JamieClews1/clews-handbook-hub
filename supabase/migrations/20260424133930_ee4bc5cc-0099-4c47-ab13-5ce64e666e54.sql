CREATE TABLE public.customer_site_rebate_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  rebate_item_id UUID NOT NULL REFERENCES public.rebate_items(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  set_value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_site_rebate_overrides_site ON public.customer_site_rebate_overrides(site_id);
CREATE INDEX idx_site_rebate_overrides_dates ON public.customer_site_rebate_overrides(start_date, end_date);

ALTER TABLE public.customer_site_rebate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rebate overrides"
ON public.customer_site_rebate_overrides
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin or management can manage rebate overrides"
ON public.customer_site_rebate_overrides
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE TRIGGER update_site_rebate_overrides_updated_at
BEFORE UPDATE ON public.customer_site_rebate_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();