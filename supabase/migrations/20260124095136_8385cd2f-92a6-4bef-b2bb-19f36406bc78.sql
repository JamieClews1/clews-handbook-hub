-- Add additional Data Hub Site columns (up to 4 total)
ALTER TABLE public.customer_sites
ADD COLUMN IF NOT EXISTS data_hub_site_2 text,
ADD COLUMN IF NOT EXISTS data_hub_site_3 text,
ADD COLUMN IF NOT EXISTS data_hub_site_4 text;

-- Add comment for clarity
COMMENT ON COLUMN public.customer_sites.data_hub_site IS 'Data Hub site mapping 1';
COMMENT ON COLUMN public.customer_sites.data_hub_site_2 IS 'Data Hub site mapping 2';
COMMENT ON COLUMN public.customer_sites.data_hub_site_3 IS 'Data Hub site mapping 3';
COMMENT ON COLUMN public.customer_sites.data_hub_site_4 IS 'Data Hub site mapping 4';