-- Add toggle rules columns to customer_site_skip_rebates
ALTER TABLE public.customer_site_skip_rebates
ADD COLUMN threshold_tonnes numeric DEFAULT 0,
ADD COLUMN rebate_enabled boolean DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN public.customer_site_skip_rebates.threshold_tonnes IS 'Minimum weight threshold in tonnes before rebate is paid. E.g., 1 means rebate only paid on weight above 1 tonne.';
COMMENT ON COLUMN public.customer_site_skip_rebates.rebate_enabled IS 'Whether rebate is enabled for this material type. If false, no rebate is calculated.';