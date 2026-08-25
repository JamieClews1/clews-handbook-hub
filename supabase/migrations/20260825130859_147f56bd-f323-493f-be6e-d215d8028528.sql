ALTER TABLE public.data_hub_jobs ADD COLUMN IF NOT EXISTS rebate_rate_per_tonne numeric;
ALTER TABLE public.data_hub_jobs_archive ADD COLUMN IF NOT EXISTS rebate_rate_per_tonne numeric;
COMMENT ON COLUMN public.data_hub_jobs.rebate_rate_per_tonne IS 'Bespoke rebate rate in GBP per tonne for this job; overrides the configured material rate when set.';