CREATE OR REPLACE FUNCTION public.can_portal_user_access_data_hub_job(_user_id uuid, _job_customer text, _job_site text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    JOIN public.customers cust
      ON cust.id = m.customer_id
    JOIN public.customer_sites cs
      ON cs.customer_id = m.customer_id
    LEFT JOIN public.customer_portal_site_access a
      ON a.membership_id = m.id
     AND a.site_id = cs.id
    WHERE m.user_id = _user_id
      AND (
        COALESCE(cust.is_broker, false) = true
        OR a.site_id IS NOT NULL
        OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
      )
      AND (
        (
          NULLIF(BTRIM(_job_site), '') IS NOT NULL
          AND _job_site IN (
            cs.data_hub_site,
            cs.data_hub_site_2,
            cs.data_hub_site_3,
            cs.data_hub_site_4,
            cs.data_hub_site_5
          )
        )
        OR (
          NULLIF(BTRIM(_job_site), '') IS NULL
          AND cs.data_hub_customer IS NOT NULL
          AND _job_customer = cs.data_hub_customer
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Portal users can view jobs for their customer" ON public.data_hub_jobs;
DROP POLICY IF EXISTS "Portal users can view jobs for their sites" ON public.data_hub_jobs;
DROP POLICY IF EXISTS "Portal users can update PO on their jobs" ON public.data_hub_jobs;

CREATE POLICY "Portal users can view accessible jobs"
ON public.data_hub_jobs
FOR SELECT
TO authenticated
USING (public.can_portal_user_access_data_hub_job(auth.uid(), customer, site));

CREATE POLICY "Portal users can update PO on accessible jobs"
ON public.data_hub_jobs
FOR UPDATE
TO authenticated
USING (public.can_portal_user_access_data_hub_job(auth.uid(), customer, site))
WITH CHECK (public.can_portal_user_access_data_hub_job(auth.uid(), customer, site));