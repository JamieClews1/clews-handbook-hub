CREATE INDEX IF NOT EXISTS idx_dhj_order_no_upper ON public.data_hub_jobs (upper(btrim(raw->>'Order No')));
CREATE INDEX IF NOT EXISTS idx_dhj_order_override_upper ON public.data_hub_jobs (upper(btrim(order_number_override)));

CREATE OR REPLACE FUNCTION public.lookup_job_weights(pairs jsonb)
RETURNS TABLE(order_number text, job_number text, source text, job_date date, customer text, site text, waste_description text, container_type text, weight_t numeric, postcode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH inputs AS (
    SELECT DISTINCT
      upper(btrim(p->>'po')) AS po,
      nullif(upper(replace(btrim(coalesce(p->>'postcode','')), ' ', '')), '') AS pc
    FROM jsonb_array_elements(pairs) p
    WHERE btrim(coalesce(p->>'po','')) <> ''
  ), cand AS (
    SELECT j.*, i.po AS mpo, i.pc AS ipc FROM inputs i
      JOIN public.data_hub_jobs j ON upper(btrim(j.raw->>'Order No')) = i.po
    UNION ALL
    SELECT j.*, i.po, i.pc FROM inputs i
      JOIN public.data_hub_jobs j ON upper(btrim(j.order_number_override)) = i.po
  ), jobs AS (
    SELECT c.*, btrim(coalesce(
        nullif(btrim(c.raw->>'Location Postc'), ''),
        nullif(btrim(c.raw->>'Postcode'), ''),
        (regexp_match(upper(concat_ws(' ', c.raw->>'Location', c.raw->>'Address 2', c.raw->>'Address 3', c.raw->>'Address 4')),
          '([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})'))[1]
      )) AS pc_text
    FROM cand c
  )
  SELECT DISTINCT j.mpo, j.job_number, j.source, j.job_date, j.customer, j.site,
    j.waste_description, j.container_type, j.weight_t, j.pc_text
  FROM jobs j
  WHERE j.ipc IS NULL OR j.pc_text IS NULL OR upper(replace(j.pc_text, ' ', '')) = j.ipc
$$;