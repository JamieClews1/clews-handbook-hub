-- Add container_type_filter column to allow multiple entries for same material with different containers
ALTER TABLE public.customer_site_skip_rebates 
ADD COLUMN container_type_filter text[] NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN public.customer_site_skip_rebates.container_type_filter IS 'Optional array of container type keywords to match. If null, matches all containers for the material type.';