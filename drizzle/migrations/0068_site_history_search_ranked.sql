CREATE OR REPLACE FUNCTION public.search_site_history_ranked(p_term text, p_source text)
RETURNS TABLE(customer text, site text, postcode text, address text, address2 text, address3 text, job_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
SET statement_timeout = '20s'
AS $$
DECLARE pat text;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  pat := '%' || regexp_replace(trim(regexp_replace(coalesce(p_term,''), '[%_\\]', ' ', 'g')), '\s+', '%', 'g') || '%';
  IF length(pat) < 5 THEN RETURN; END IF;
  RETURN QUERY
  WITH m AS (
    SELECT j.customer, j.site, j.postcode, j.job_date,
      j.raw->>'Location Postc_1' a1, j.raw->>'Address 2nd LIne' a2, j.raw->>'Address 3' a3,
      count(*) OVER (PARTITION BY lower(coalesce(j.customer,'')), lower(coalesce(j.site,''))) c
    FROM data_hub_jobs j
    WHERE j.source = p_source
      AND (j.customer ILIKE pat OR j.site ILIKE pat OR j.postcode ILIKE pat
        OR j.raw->>'Location Postc_1' ILIKE pat OR j.raw->>'Address 2nd LIne' ILIKE pat OR j.raw->>'Address 3' ILIKE pat)
  )
  SELECT DISTINCT ON (lower(coalesce(m.customer,'')), lower(coalesce(m.site,'')))
    m.customer, m.site, m.postcode, m.a1, m.a2, m.a3, m.c
  FROM m
  ORDER BY lower(coalesce(m.customer,'')), lower(coalesce(m.site,'')), m.job_date DESC NULLS LAST;
END $$;
REVOKE ALL ON FUNCTION public.search_site_history_ranked(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_site_history_ranked(text,text) TO authenticated;