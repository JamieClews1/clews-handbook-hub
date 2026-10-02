CREATE OR REPLACE FUNCTION public.get_skiptrak_customer_sites_json()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('customer', customer, 'site', site)), '[]'::jsonb)
  FROM (SELECT DISTINCT customer, site FROM public.data_hub_jobs
        WHERE source = 'skiptrak' AND customer IS NOT NULL) x
  WHERE public.is_staff(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.get_skiptrak_customer_sites_json() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_skiptrak_customer_sites_json() TO authenticated;