CREATE OR REPLACE FUNCTION public.lookup_job_weights(pairs jsonb)
 RETURNS TABLE(order_number text, job_number text, source text, job_date date, customer text, site text, waste_description text, container_type text, weight_t numeric, postcode text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH inputs AS (
    SELECT
      upper(btrim(p->>'po')) AS po,
      nullif(upper(replace(btrim(coalesce(p->>'postcode','')), ' ', '')), '') AS pc
    FROM jsonb_array_elements(pairs) p
    WHERE btrim(coalesce(p->>'po','')) <> ''
  ), jobs AS (
    SELECT
      j.*,
      btrim(coalesce(
        nullif(btrim(j.raw->>'Location Postc'), ''),
        nullif(btrim(j.raw->>'Postcode'), ''),
        (regexp_match(upper(concat_ws(' ', j.raw->>'Location', j.raw->>'Address 2', j.raw->>'Address 3', j.raw->>'Address 4')),
          '([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})'))[1]
      )) AS pc_text
    FROM public.data_hub_jobs j
  )
  SELECT DISTINCT
    matched.po AS order_number,
    j.job_number,
    j.source,
    j.job_date,
    j.customer,
    j.site,
    j.waste_description,
    j.container_type,
    j.weight_t,
    j.pc_text AS postcode
  FROM jobs j
  CROSS JOIN LATERAL (
    VALUES (btrim(j.order_number_override)), (btrim(j.raw->>'Order No'))
  ) AS matched(po)
  JOIN inputs i
    ON i.po = upper(matched.po)
  WHERE matched.po IS NOT NULL
    AND matched.po <> ''
    AND (
      i.pc IS NULL
      OR j.pc_text IS NULL
      OR upper(replace(j.pc_text, ' ', '')) = i.pc
    )
$function$;