ALTER TABLE public.customer_sites
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customer_sites_is_archived ON public.customer_sites (customer_id, is_archived);

WITH recent_s AS (
  SELECT DISTINCT lower(btrim(site)) s FROM public.data_hub_jobs
  WHERE job_date >= current_date - interval '12 months' AND nullif(btrim(coalesce(site,'')),'') IS NOT NULL
),
recent_c AS (
  SELECT DISTINCT lower(btrim(customer)) c FROM public.data_hub_jobs
  WHERE job_date >= current_date - interval '12 months' AND customer IS NOT NULL
),
al AS (
  SELECT cs.id, lower(btrim(x)) nm
  FROM public.customer_sites cs,
  LATERAL unnest(ARRAY[cs.data_hub_site,cs.data_hub_site_2,cs.data_hub_site_3,cs.data_hub_site_4,cs.data_hub_site_5]) x
  WHERE nullif(btrim(coalesce(x,'')),'') IS NOT NULL
),
active AS (
  SELECT DISTINCT al.id FROM al JOIN recent_s r ON r.s = al.nm
  UNION
  SELECT cs.id FROM public.customer_sites cs
  JOIN recent_c r ON r.c = lower(btrim(cs.data_hub_customer))
  WHERE NOT EXISTS (SELECT 1 FROM al WHERE al.id = cs.id)
    AND nullif(btrim(coalesce(cs.data_hub_customer,'')),'') IS NOT NULL
)
UPDATE public.customer_sites cs
SET is_archived = true, archived_at = now(), updated_at = now()
WHERE cs.is_archived = false
  AND NOT EXISTS (SELECT 1 FROM active a WHERE a.id = cs.id);