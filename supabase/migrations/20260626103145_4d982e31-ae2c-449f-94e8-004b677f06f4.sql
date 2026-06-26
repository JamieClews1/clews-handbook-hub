ALTER TABLE public.customer_site_skip_rebates
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

ALTER TABLE public.customer_skip_rebates
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;