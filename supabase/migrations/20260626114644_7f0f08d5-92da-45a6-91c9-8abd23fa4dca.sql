CREATE TABLE public.biffa_fuel_surcharge_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  percentage numeric NOT NULL DEFAULT 0,
  included_customers text[] NOT NULL DEFAULT '{}',
  haulier_filter text NOT NULL DEFAULT 'Biffa',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biffa_fuel_surcharge_settings TO authenticated;
GRANT ALL ON public.biffa_fuel_surcharge_settings TO service_role;

ALTER TABLE public.biffa_fuel_surcharge_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view biffa fuel surcharge settings"
  ON public.biffa_fuel_surcharge_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage biffa fuel surcharge settings"
  ON public.biffa_fuel_surcharge_settings FOR ALL
  USING (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_biffa_fuel_surcharge_settings_updated_at
  BEFORE UPDATE ON public.biffa_fuel_surcharge_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.biffa_fuel_surcharge_settings (percentage, included_customers, haulier_filter)
VALUES (0, ARRAY['Biffa (Leics)','Biffa (Northampton)','Biffa Waste'], 'Biffa');