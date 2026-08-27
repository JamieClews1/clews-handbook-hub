ALTER TABLE public.data_hub_jobs ADD COLUMN IF NOT EXISTS postcode text;

UPDATE public.data_hub_jobs
SET postcode = COALESCE(raw->>'Location Postc', raw->>'Location Postcode', raw->>'Postcode')
WHERE postcode IS NULL
  AND raw IS NOT NULL
  AND COALESCE(raw->>'Location Postc', raw->>'Location Postcode', raw->>'Postcode') IS NOT NULL;

CREATE INDEX IF NOT EXISTS data_hub_jobs_postcode_idx ON public.data_hub_jobs (lower(postcode) text_pattern_ops) WHERE postcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.data_hub_jobs_sync_postcode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.postcode := COALESCE(NEW.raw->>'Location Postc', NEW.raw->>'Location Postcode', NEW.raw->>'Postcode');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_data_hub_jobs_sync_postcode ON public.data_hub_jobs;
CREATE TRIGGER trg_data_hub_jobs_sync_postcode
BEFORE INSERT OR UPDATE OF raw ON public.data_hub_jobs
FOR EACH ROW EXECUTE FUNCTION public.data_hub_jobs_sync_postcode();