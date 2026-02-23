
-- Stock reports table
CREATE TABLE public.stock_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operator_id UUID REFERENCES auth.users(id),
  operator_name TEXT NOT NULL,
  total_on_stock INTEGER NOT NULL DEFAULT 0,
  total_out INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock reports"
  ON public.stock_reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stock reports"
  ON public.stock_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update stock reports"
  ON public.stock_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete stock reports"
  ON public.stock_reports FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Stock report line items
CREATE TABLE public.stock_report_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_report_id UUID NOT NULL REFERENCES public.stock_reports(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  on_stock INTEGER NOT NULL DEFAULT 0,
  out INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock report items"
  ON public.stock_report_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stock report items"
  ON public.stock_report_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Stock report email settings
CREATE TABLE public.stock_report_email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_report_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock email settings"
  ON public.stock_report_email_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage stock email settings"
  ON public.stock_report_email_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_stock_reports_updated_at
  BEFORE UPDATE ON public.stock_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_report_email_settings_updated_at
  BEFORE UPDATE ON public.stock_report_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
