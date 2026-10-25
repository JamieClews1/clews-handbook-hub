CREATE OR REPLACE FUNCTION public.get_outgoing_sites()
RETURNS TABLE(site_name text, loads integer, last_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH src AS (
    SELECT btrim(raw->>'Company /Surname') AS n, job_date AS d
      FROM data_hub_jobs WHERE source = 'midweigh' AND raw->>'In / Out' = 'OUTWARD'
    UNION ALL
    SELECT btrim(customer), (coalesce(second_weigh_at, first_weigh_at))::date
      FROM weighbridge_transactions WHERE job_type = 'waste_out' AND status <> 'voided'
  )
  SELECT min(n), count(*)::int, max(d) FROM src
   WHERE public.is_staff(auth.uid()) AND coalesce(n, '') <> '' AND n !~* '^(clews recycling|void)'
   GROUP BY lower(n) ORDER BY max(d) DESC NULLS LAST, count(*) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_outgoing_sites() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_outgoing_sites() TO authenticated;