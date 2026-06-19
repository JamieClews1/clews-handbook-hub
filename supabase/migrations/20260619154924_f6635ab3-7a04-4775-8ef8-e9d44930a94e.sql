CREATE OR REPLACE FUNCTION public.get_skiptrak_rental_positions()
RETURNS TABLE (
  site text,
  container_type text,
  ewc text,
  customer text,
  delivered integer,
  collected integer,
  exchanged integer,
  tipreturn integer,
  last_keep_date date,
  last_collection_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(d.site, 'Unknown') AS site,
      d.container_type AS container_type,
      COALESCE(NULLIF(TRIM(d.ewc), ''), '__none__') AS ewc,
      d.customer AS customer,
      d.job_date AS job_date,
      d.movement_type AS movement_type
    FROM public.data_hub_jobs d
    WHERE d.source = 'skiptrak'
      AND d.movement_type IN ('Deliver', 'Exchange', 'Collect', 'Tip/Return')
      AND d.container_type IS NOT NULL
  ),
  latest_cust AS (
    SELECT DISTINCT ON (b.site, b.container_type, b.ewc)
      b.site, b.container_type, b.ewc, b.customer
    FROM base b
    ORDER BY b.site, b.container_type, b.ewc, b.job_date DESC NULLS LAST
  )
  SELECT
    b.site,
    b.container_type,
    b.ewc,
    lc.customer,
    COUNT(*) FILTER (WHERE b.movement_type = 'Deliver')::integer AS delivered,
    COUNT(*) FILTER (WHERE b.movement_type = 'Collect')::integer AS collected,
    COUNT(*) FILTER (WHERE b.movement_type = 'Exchange')::integer AS exchanged,
    COUNT(*) FILTER (WHERE b.movement_type = 'Tip/Return')::integer AS tipreturn,
    MAX(b.job_date) FILTER (WHERE b.movement_type IN ('Deliver', 'Exchange', 'Tip/Return')) AS last_keep_date,
    MAX(b.job_date) FILTER (WHERE b.movement_type = 'Collect') AS last_collection_date
  FROM base b
  JOIN latest_cust lc
    ON lc.site = b.site AND lc.container_type = b.container_type AND lc.ewc = b.ewc
  GROUP BY b.site, b.container_type, b.ewc, lc.customer;
$$;

GRANT EXECUTE ON FUNCTION public.get_skiptrak_rental_positions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_skiptrak_rental_positions() TO service_role;