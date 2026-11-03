ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS producer_sic text,
  ADD COLUMN IF NOT EXISTS receiving_sic text,
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS broker_address text,
  ADD COLUMN IF NOT EXISTS broker_sic text;
ALTER TABLE public.verified_tipping_sites ADD COLUMN IF NOT EXISTS sic_code text;