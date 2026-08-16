CREATE TABLE public.dwt_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_physical_form text NOT NULL DEFAULT 'Solid',
  default_container_type text NOT NULL DEFAULT 'Van',
  default_means_of_transport text NOT NULL DEFAULT 'Road',
  default_carrier_name text NOT NULL DEFAULT '',
  default_carrier_registration text NOT NULL DEFAULT '',
  autofill_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dwt_settings TO authenticated;
GRANT ALL ON public.dwt_settings TO service_role;

ALTER TABLE public.dwt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view DWT settings"
ON public.dwt_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage DWT settings"
ON public.dwt_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_dwt_settings_updated_at
BEFORE UPDATE ON public.dwt_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.dwt_settings (default_physical_form, default_container_type) VALUES ('Solid', 'Van');