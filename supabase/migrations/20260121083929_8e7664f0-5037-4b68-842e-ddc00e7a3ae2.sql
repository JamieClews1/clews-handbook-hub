-- Add pallet_weight_kg column to load_waste_types for pallet deduction
ALTER TABLE public.load_waste_types ADD COLUMN pallet_weight_kg numeric NOT NULL DEFAULT 20;

-- Create a settings table for global load report settings
CREATE TABLE public.load_report_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.load_report_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage settings" ON public.load_report_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view settings" ON public.load_report_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert default pallet weight setting
INSERT INTO public.load_report_settings (setting_key, setting_value)
VALUES ('default_pallet_weight_kg', '20');

-- Update trigger for updated_at
CREATE TRIGGER update_load_report_settings_updated_at
  BEFORE UPDATE ON public.load_report_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();