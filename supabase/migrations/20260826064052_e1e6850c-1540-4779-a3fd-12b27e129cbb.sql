ALTER TABLE public.customer_sites
  ADD COLUMN IF NOT EXISTS address_1 text,
  ADD COLUMN IF NOT EXISTS address_2 text,
  ADD COLUMN IF NOT EXISTS address_3 text,
  ADD COLUMN IF NOT EXISTS address_4 text,
  ADD COLUMN IF NOT EXISTS address_5 text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS sic_code text,
  ADD COLUMN IF NOT EXISTS site_contact_name text,
  ADD COLUMN IF NOT EXISTS site_contact_phone text;