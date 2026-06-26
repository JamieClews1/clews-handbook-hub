UPDATE public.customer_site_skip_rebates
SET effective_from = '2026-05-24'
WHERE waste_description_filter @> ARRAY['Plastic Packaging']::text[]
  AND effective_from IS NULL;