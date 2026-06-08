DROP FUNCTION IF EXISTS public.lookup_job_weights(text[]);
DROP FUNCTION IF EXISTS public.lookup_job_weights(text[], text);

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
    btrim(j.raw->>'Location Postc') AS postcode
  FROM public.data_hub_jobs j
  CROSS JOIN LATERAL (
    VALUES (btrim(j.order_number_override)), (btrim(j.raw->>'Order No'))
  ) AS matched(po)
  JOIN inputs i
    ON i.po = upper(matched.po)
  WHERE matched.po IS NOT NULL
    AND matched.po <> ''
    AND (
      i.pc IS NULL
      OR upper(replace(btrim(j.raw->>'Location Postc'), ' ', '')) = i.pc
    )
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_job_weights(jsonb) TO anon, authenticated, service_role;