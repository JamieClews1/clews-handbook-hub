-- Convert the site-level skip rebate material_type from a restrictive enum
-- to free text so any rebate item can be selected as a material.
ALTER TABLE public.customer_site_skip_rebates
  ALTER COLUMN material_type TYPE text USING material_type::text;