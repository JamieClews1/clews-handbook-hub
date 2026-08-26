ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS operator_signature text,
  ADD COLUMN IF NOT EXISTS driver_signature text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_image text;

CREATE OR REPLACE FUNCTION public.get_midweigh_container_types()
RETURNS TABLE(container_type text, vehicle_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vals AS (
    SELECT DISTINCT btrim(raw->>'Container') AS c
    FROM public.data_hub_jobs
    WHERE source = 'midweigh'
      AND raw->>'Container' IS NOT NULL
      AND btrim(raw->>'Container') <> ''
      AND btrim(raw->>'Container') !~ '^[0-9.]+$'
  )
  SELECT c,
    CASE
      WHEN c ILIKE '%ro ro%' OR c ILIKE '%roro%' OR c ILIKE '%roll on%' THEN 'Roll on Roll off'
      WHEN c ILIKE '%skip%' THEN 'Skip'
      WHEN c ILIKE '%curtain%' THEN 'Curtainside'
      WHEN c ILIKE '%walking floor%' THEN 'Walking Floor'
      WHEN c ILIKE '%ejector%' THEN 'Ejector Trailer'
      WHEN c ILIKE '%bulk%' THEN 'Bulker'
      WHEN c ILIKE '%pick up%' OR c ILIKE '%pickup%' THEN 'Pick Up'
      WHEN c ILIKE '%wheelie%' THEN 'Wheelie Bin'
      WHEN c ILIKE '%dolav%' THEN 'Dolav'
      WHEN c ILIKE '%container%' THEN 'Shipping Container'
      WHEN c ILIKE '%trailer%' THEN 'Trailer'
      WHEN c ILIKE '%yard%' OR c ILIKE '% yd%' THEN 'Skip'
      ELSE 'Other'
    END
  FROM vals
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_midweigh_container_types() TO authenticated;