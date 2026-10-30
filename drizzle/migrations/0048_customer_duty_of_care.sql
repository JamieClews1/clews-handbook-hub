ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS waste_carrier_licence text,
  ADD COLUMN IF NOT EXISTS waste_carrier_licence_expiry date,
  ADD COLUMN IF NOT EXISTS sic_code text;