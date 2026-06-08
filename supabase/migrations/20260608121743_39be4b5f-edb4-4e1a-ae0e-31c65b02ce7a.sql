CREATE OR REPLACE FUNCTION public.lookup_job_weights(order_numbers text[], p_postcode text DEFAULT NULL)
 RETURNS TABLE(order_number text, job_number text, source text, job_date date, customer text, site text, waste_description text, container_type text, weight_t numeric, postcode text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE matched.po IS NOT NULL
    AND matched.po <> ''
    AND upper(matched.po) = ANY (
      SELECT upper(btrim(x)) FROM unnest(order_numbers) x WHERE btrim(x) <> ''
    )
    AND (
      p_postcode IS NULL
      OR btrim(p_postcode) = ''
      OR upper(replace(btrim(j.raw->>'Location Postc'), ' ', '')) = upper(replace(btrim(p_postcode), ' ', ''))
    )
$function$;