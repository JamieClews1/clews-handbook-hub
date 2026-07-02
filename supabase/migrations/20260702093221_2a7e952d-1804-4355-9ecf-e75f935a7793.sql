CREATE OR REPLACE FUNCTION public.get_skiptrak_customer_sites()
 RETURNS TABLE(customer text, site text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT customer, site
  FROM public.data_hub_jobs
  WHERE source = 'skiptrak'
    AND customer IS NOT NULL
  ORDER BY customer, site
$function$;