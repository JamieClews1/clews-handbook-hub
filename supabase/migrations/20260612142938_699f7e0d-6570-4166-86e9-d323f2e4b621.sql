ALTER TABLE public.customer_site_price_sets
  ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT '2000-01-01',
  ADD COLUMN IF NOT EXISTS effective_to DATE;

ALTER TABLE public.customer_site_price_sets
  DROP CONSTRAINT IF EXISTS customer_site_price_sets_site_id_key;

ALTER TABLE public.customer_site_price_sets
  ADD CONSTRAINT customer_site_price_sets_site_effective_from_key UNIQUE (site_id, effective_from);