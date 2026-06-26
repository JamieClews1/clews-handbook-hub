ALTER TABLE public.customer_site_skip_rebates
  ADD COLUMN IF NOT EXISTS waste_description_filter text[];

ALTER TABLE public.customer_skip_rebates
  ADD COLUMN IF NOT EXISTS waste_description_filter text[];

COMMENT ON COLUMN public.customer_site_skip_rebates.waste_description_filter IS
  'Optional list of exact data_hub_jobs.waste_description values that map to this rebate line for THIS site only (e.g. Britvic "Plastic Packaging" = plastic bottles). When set, jobs are matched by these waste descriptions instead of the global material category mapping.';