ALTER TABLE public.data_hub_jobs
  ADD COLUMN IF NOT EXISTS waste_corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS ewc_original text,
  ADD COLUMN IF NOT EXISTS waste_description_original text;

COMMENT ON COLUMN public.data_hub_jobs.waste_corrected_at IS 'Set when staff corrected the waste name/EWC in the portal; Data Uploads keep the corrected values instead of the export''s.';
COMMENT ON COLUMN public.data_hub_jobs.ewc_original IS 'EWC as originally recorded in the source system before a portal correction.';
COMMENT ON COLUMN public.data_hub_jobs.waste_description_original IS 'Waste description as originally recorded before a portal correction.';