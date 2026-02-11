
-- Staci pallet colour rates with time-period support
-- Each row defines a rate for a colour starting from effective_from date
-- To find the active rate: latest effective_from <= target date

CREATE TABLE public.staci_pallet_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colour TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(colour, effective_from)
);

-- Enable RLS
ALTER TABLE public.staci_pallet_rates ENABLE ROW LEVEL SECURITY;

-- Management users can read/write
CREATE POLICY "Management can view staci pallet rates"
  ON public.staci_pallet_rates FOR SELECT
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management can insert staci pallet rates"
  ON public.staci_pallet_rates FOR INSERT
  WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can update staci pallet rates"
  ON public.staci_pallet_rates FOR UPDATE
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management can delete staci pallet rates"
  ON public.staci_pallet_rates FOR DELETE
  USING (public.is_management(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_staci_pallet_rates_updated_at
  BEFORE UPDATE ON public.staci_pallet_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current hardcoded rates as the initial period (effective from a historic date)
INSERT INTO public.staci_pallet_rates (colour, rate, effective_from) VALUES
  ('red', 42.00, '2025-01-01'),
  ('yellow', 22.00, '2025-01-01'),
  ('blue', 9.00, '2025-01-01'),
  ('green', -18.00, '2025-01-01'),
  ('waste_wood', 45.00, '2025-01-01');

-- Also include pallet good rebate and pallet weight charge rate
-- so they can also be managed per period
CREATE TABLE public.staci_pallet_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_key TEXT NOT NULL,
  charge_value NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(charge_key, effective_from)
);

ALTER TABLE public.staci_pallet_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view staci pallet charges"
  ON public.staci_pallet_charges FOR SELECT
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management can insert staci pallet charges"
  ON public.staci_pallet_charges FOR INSERT
  WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can update staci pallet charges"
  ON public.staci_pallet_charges FOR UPDATE
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management can delete staci pallet charges"
  ON public.staci_pallet_charges FOR DELETE
  USING (public.is_management(auth.uid()));

CREATE TRIGGER update_staci_pallet_charges_updated_at
  BEFORE UPDATE ON public.staci_pallet_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current charges
INSERT INTO public.staci_pallet_charges (charge_key, charge_value, effective_from) VALUES
  ('good_pallet_rebate', 0.75, '2025-01-01'),
  ('pallet_weight_charge', -47.00, '2025-01-01');
