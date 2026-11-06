CREATE OR REPLACE FUNCTION public.search_site_history(p_term text, p_source text)
RETURNS TABLE(customer text, site text, postcode text, address text, address2 text, address3 text)
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
  SELECT DISTINCT ON (lower(coalesce(j.customer,'')), lower(coalesce(j.site,'')))
    j.customer, j.site, j.postcode,
    j.raw->>'Location Postc_1', j.raw->>'Address 2nd LIne', j.raw->>'Address 3'
  FROM data_hub_jobs j
  WHERE j.source = p_source
    AND (j.customer ILIKE pat OR j.site ILIKE pat OR j.postcode ILIKE pat
      OR j.raw->>'Location Postc_1' ILIKE pat OR j.raw->>'Address 2nd LIne' ILIKE pat OR j.raw->>'Address 3' ILIKE pat)
  ORDER BY lower(coalesce(j.customer,'')), lower(coalesce(j.site,'')), j.job_date DESC NULLS LAST;
END $$;
REVOKE ALL ON FUNCTION public.search_site_history(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_site_history(text,text) TO authenticated;