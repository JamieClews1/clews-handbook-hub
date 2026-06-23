CREATE TABLE public.pricing_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_settings TO authenticated;
GRANT ALL ON public.pricing_settings TO service_role;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing settings"
ON public.pricing_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/management can manage pricing settings"
ON public.pricing_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

INSERT INTO public.pricing_settings (setting_key, setting_value)
VALUES ('auto_add_fuel_surcharge', 'false'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;