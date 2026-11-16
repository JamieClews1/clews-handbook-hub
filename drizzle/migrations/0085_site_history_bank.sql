CREATE TABLE public.site_history_bank (
  source text NOT NULL,
  customer text NOT NULL DEFAULT '',
  site text NOT NULL DEFAULT '',
  postcode text,
  address text,
  address2 text,
  address3 text,
  job_count integer NOT NULL DEFAULT 0,
  first_date date,
  last_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, customer, site)
);

GRANT SELECT ON public.site_history_bank TO authenticated;
GRANT ALL ON public.site_history_bank TO service_role;

ALTER TABLE public.site_history_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read the site history bank"
ON public.site_history_bank FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX site_history_bank_source_last_idx ON public.site_history_bank (source, last_date DESC NULLS LAST);

-- Full rebuild from retained jobs (nightly safety net and first fill).
CREATE OR REPLACE FUNCTION public.rebuild_site_history_bank()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
AS $$
DECLARE n integer;
BEGIN
  CREATE TEMP TABLE _site_bank ON COMMIT DROP AS
  SELECT DISTINCT ON (x.source, x.customer, x.site)
    x.source, x.customer, x.site, x.postcode, x.a1, x.a2, x.a3, x.cnt, x.first_d, x.last_d
  FROM (
    SELECT j.source, coalesce(j.customer,'') AS customer, coalesce(j.site,'') AS site, j.postcode,
      j.raw->>'Location Postc_1' AS a1, j.raw->>'Address 2nd LIne' AS a2, j.raw->>'Address 3' AS a3, j.job_date,
      count(*) OVER w AS cnt, min(j.job_date) OVER w AS first_d, max(j.job_date) OVER w AS last_d
    FROM public.data_hub_jobs j
    WHERE j.source IN ('skiptrak','midweigh')
    WINDOW w AS (PARTITION BY j.source, coalesce(j.customer,''), coalesce(j.site,''))
  ) x
  ORDER BY x.source, x.customer, x.site, x.job_date DESC NULLS LAST;

  INSERT INTO public.site_history_bank AS b (source, customer, site, postcode, address, address2, address3, job_count, first_date, last_date, updated_at)
  SELECT source, customer, site, postcode, a1, a2, a3, cnt, first_d, last_d, now() FROM _site_bank
  ON CONFLICT (source, customer, site) DO UPDATE SET
    postcode = excluded.postcode, address = excluded.address, address2 = excluded.address2, address3 = excluded.address3,
    job_count = excluded.job_count, first_date = excluded.first_date, last_date = excluded.last_date, updated_at = now()
  WHERE (b.postcode, b.address, b.address2, b.address3, b.job_count, b.first_date, b.last_date)
    IS DISTINCT FROM (excluded.postcode, excluded.address, excluded.address2, excluded.address3, excluded.job_count, excluded.first_date, excluded.last_date);

  DELETE FROM public.site_history_bank b
  WHERE NOT EXISTS (SELECT 1 FROM _site_bank s WHERE s.source = b.source AND s.customer = b.customer AND s.site = b.site);

  SELECT count(*) INTO n FROM public.site_history_bank;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.rebuild_site_history_bank() FROM PUBLIC, anon, authenticated;

-- Live upkeep as jobs are uploaded, edited or removed.
CREATE OR REPLACE FUNCTION public.site_history_bank_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.source IN ('skiptrak','midweigh') THEN
    IF TG_OP = 'UPDATE'
       AND NEW.source IS NOT DISTINCT FROM OLD.source
       AND NEW.customer IS NOT DISTINCT FROM OLD.customer
       AND NEW.site IS NOT DISTINCT FROM OLD.site
       AND NEW.postcode IS NOT DISTINCT FROM OLD.postcode
       AND NEW.job_date IS NOT DISTINCT FROM OLD.job_date
       AND (NEW.raw->>'Location Postc_1') IS NOT DISTINCT FROM (OLD.raw->>'Location Postc_1')
       AND (NEW.raw->>'Address 2nd LIne') IS NOT DISTINCT FROM (OLD.raw->>'Address 2nd LIne')
       AND (NEW.raw->>'Address 3') IS NOT DISTINCT FROM (OLD.raw->>'Address 3') THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' OR NEW.source IS DISTINCT FROM OLD.source OR NEW.customer IS DISTINCT FROM OLD.customer OR NEW.site IS DISTINCT FROM OLD.site THEN
      UPDATE public.site_history_bank SET job_count = greatest(job_count - 1, 0), updated_at = now()
      WHERE source = OLD.source AND customer = coalesce(OLD.customer,'') AND site = coalesce(OLD.site,'');
      DELETE FROM public.site_history_bank
      WHERE source = OLD.source AND customer = coalesce(OLD.customer,'') AND site = coalesce(OLD.site,'') AND job_count = 0;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    END IF;
  END IF;

  IF NEW.source NOT IN ('skiptrak','midweigh') THEN RETURN NEW; END IF;

  INSERT INTO public.site_history_bank AS b (source, customer, site, postcode, address, address2, address3, job_count, first_date, last_date, updated_at)
  VALUES (NEW.source, coalesce(NEW.customer,''), coalesce(NEW.site,''), NEW.postcode,
          NEW.raw->>'Location Postc_1', NEW.raw->>'Address 2nd LIne', NEW.raw->>'Address 3', 1, NEW.job_date, NEW.job_date, now())
  ON CONFLICT (source, customer, site) DO UPDATE SET
    job_count = b.job_count + CASE
      WHEN TG_OP = 'INSERT' THEN 1
      WHEN OLD.source IS DISTINCT FROM NEW.source OR OLD.customer IS DISTINCT FROM NEW.customer OR OLD.site IS DISTINCT FROM NEW.site THEN 1
      ELSE 0 END,
    first_date = least(b.first_date, excluded.first_date),
    last_date = greatest(b.last_date, excluded.last_date),
    postcode = CASE WHEN excluded.last_date IS NOT NULL AND excluded.last_date >= coalesce(b.last_date, excluded.last_date) THEN coalesce(excluded.postcode, b.postcode) ELSE coalesce(b.postcode, excluded.postcode) END,
    address = CASE WHEN excluded.last_date IS NOT NULL AND excluded.last_date >= coalesce(b.last_date, excluded.last_date) THEN coalesce(excluded.address, b.address) ELSE coalesce(b.address, excluded.address) END,
    address2 = CASE WHEN excluded.last_date IS NOT NULL AND excluded.last_date >= coalesce(b.last_date, excluded.last_date) THEN coalesce(excluded.address2, b.address2) ELSE coalesce(b.address2, excluded.address2) END,
    address3 = CASE WHEN excluded.last_date IS NOT NULL AND excluded.last_date >= coalesce(b.last_date, excluded.last_date) THEN coalesce(excluded.address3, b.address3) ELSE coalesce(b.address3, excluded.address3) END,
    updated_at = now();
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.site_history_bank_capture() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER data_hub_jobs_site_history_bank
AFTER INSERT OR UPDATE OR DELETE ON public.data_hub_jobs
FOR EACH ROW EXECUTE FUNCTION public.site_history_bank_capture();

-- Search now reads the small site bank, most recently worked sites first.
DROP FUNCTION IF EXISTS public.search_site_history_ranked(text, text);
CREATE FUNCTION public.search_site_history_ranked(p_term text, p_source text)
RETURNS TABLE(customer text, site text, postcode text, address text, address2 text, address3 text, job_count bigint, last_date date)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
DECLARE pat text;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  pat := '%' || regexp_replace(trim(regexp_replace(coalesce(p_term,''), '[%_\\]', ' ', 'g')), '\s+', '%', 'g') || '%';
  IF length(pat) < 5 THEN RETURN; END IF;
  RETURN QUERY
  SELECT nullif(b.customer,''), nullif(b.site,''), b.postcode, b.address, b.address2, b.address3, b.job_count::bigint, b.last_date
  FROM public.site_history_bank b
  WHERE b.source = p_source
    AND (b.customer ILIKE pat OR b.site ILIKE pat OR b.postcode ILIKE pat OR b.address ILIKE pat OR b.address2 ILIKE pat OR b.address3 ILIKE pat)
  ORDER BY b.last_date DESC NULLS LAST, b.job_count DESC
  LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.search_site_history_ranked(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_site_history_ranked(text, text) TO authenticated;

SELECT public.rebuild_site_history_bank();

SELECT cron.schedule('site-history-bank-nightly', '40 3 * * *', $$SELECT public.rebuild_site_history_bank();$$);