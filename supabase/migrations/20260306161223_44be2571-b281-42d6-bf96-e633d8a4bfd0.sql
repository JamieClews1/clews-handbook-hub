ALTER TABLE public.data_hub_jobs ADD COLUMN IF NOT EXISTS driver text;
ALTER TABLE public.data_hub_jobs ADD COLUMN IF NOT EXISTS tipping_location text;