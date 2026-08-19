
DELETE FROM public.customer_contacts
WHERE lower(split_part(btrim(email), '@', 2)) IN ('clewsrecycling.co.uk','noreply.clewsrecycling.co.uk');

CREATE OR REPLACE FUNCTION public.crm_match_customer_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH e AS (
    SELECT lower(btrim(_email)) AS addr,
           lower(split_part(btrim(_email), '@', 2)) AS domain
  )
  SELECT id FROM (
    SELECT cc.customer_id AS id, 1 AS rank
    FROM public.customer_contacts cc, e
    WHERE lower(btrim(cc.email)) = e.addr AND e.addr <> ''
      AND e.domain NOT IN ('clewsrecycling.co.uk','noreply.clewsrecycling.co.uk')
    UNION ALL
    SELECT cf.customer_id, 2
    FROM public.customer_finance_details cf, e
    WHERE lower(btrim(cf.finance_contact_email)) = e.addr AND e.addr <> ''
      AND e.domain NOT IN ('clewsrecycling.co.uk','noreply.clewsrecycling.co.uk')
    UNION ALL
    SELECT cc.customer_id, 3
    FROM public.customer_contacts cc, e
    WHERE e.domain <> ''
      AND e.domain NOT IN ('gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.co.uk','icloud.com','live.co.uk','btinternet.com','aol.com','me.com','msn.com','clewsrecycling.co.uk','noreply.clewsrecycling.co.uk')
      AND lower(split_part(btrim(cc.email), '@', 2)) = e.domain
  ) m
  ORDER BY rank
  LIMIT 1;
$$;

UPDATE public.crm_tickets t
SET customer_id = public.crm_match_customer_by_email(t.sender_email),
    site_id = CASE WHEN public.crm_match_customer_by_email(t.sender_email) IS DISTINCT FROM t.customer_id THEN NULL ELSE t.site_id END
WHERE t.customer_id IS NOT NULL
  AND public.crm_match_customer_by_email(t.sender_email) IS DISTINCT FROM t.customer_id;
