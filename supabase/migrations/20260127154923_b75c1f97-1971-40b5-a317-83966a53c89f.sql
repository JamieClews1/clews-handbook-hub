-- Add RLS policy to allow portal users to read data_hub_jobs for their accessible sites
CREATE POLICY "Portal users can view jobs for their sites"
ON public.data_hub_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_sites cs
    JOIN public.customer_portal_memberships m ON m.customer_id = cs.customer_id
    WHERE m.user_id = auth.uid()
    AND (
      -- Check explicit site access
      EXISTS (
        SELECT 1 FROM public.customer_portal_site_access a
        WHERE a.membership_id = m.id AND a.site_id = cs.id
      )
      OR
      -- Or user is the owner contact of this site
      (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
    )
    AND (
      -- Match job site against any of the site mappings
      data_hub_jobs.site = cs.data_hub_site
      OR data_hub_jobs.site = cs.data_hub_site_2
      OR data_hub_jobs.site = cs.data_hub_site_3
      OR data_hub_jobs.site = cs.data_hub_site_4
    )
  )
);