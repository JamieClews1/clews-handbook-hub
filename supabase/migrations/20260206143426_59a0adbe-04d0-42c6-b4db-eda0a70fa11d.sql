-- Allow multiple skip rebate rows per (site_id, material_type)
ALTER TABLE public.customer_site_skip_rebates
  DROP CONSTRAINT IF EXISTS customer_site_skip_rebates_site_id_material_type_key;

-- Ensure value_type constraint matches the UI options (incl. bespoke)
ALTER TABLE public.customer_site_skip_rebates
  DROP CONSTRAINT IF EXISTS customer_site_skip_rebates_value_type_check;

ALTER TABLE public.customer_site_skip_rebates
  ADD CONSTRAINT customer_site_skip_rebates_value_type_check
  CHECK (
    value_type = ANY (ARRAY['lower'::text, 'higher'::text, 'set'::text, 'bespoke'::text])
  );

-- Helpful for common lookups by site
CREATE INDEX IF NOT EXISTS idx_customer_site_skip_rebates_site_id
  ON public.customer_site_skip_rebates (site_id);