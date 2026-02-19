-- Allow portal users to update the order_number_override on jobs they can see
CREATE POLICY "Portal users can update PO on their jobs"
ON public.data_hub_jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM customer_sites cs
    JOIN customer_portal_memberships m ON m.customer_id = cs.customer_id
    WHERE m.user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM customer_portal_site_access a
          WHERE a.membership_id = m.id AND a.site_id = cs.id
        )
        OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
      )
      AND (
        (cs.data_hub_customer IS NOT NULL AND data_hub_jobs.customer = cs.data_hub_customer)
        OR data_hub_jobs.site = cs.data_hub_site
        OR data_hub_jobs.site = cs.data_hub_site_2
        OR data_hub_jobs.site = cs.data_hub_site_3
        OR data_hub_jobs.site = cs.data_hub_site_4
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM customer_sites cs
    JOIN customer_portal_memberships m ON m.customer_id = cs.customer_id
    WHERE m.user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM customer_portal_site_access a
          WHERE a.membership_id = m.id AND a.site_id = cs.id
        )
        OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
      )
      AND (
        (cs.data_hub_customer IS NOT NULL AND data_hub_jobs.customer = cs.data_hub_customer)
        OR data_hub_jobs.site = cs.data_hub_site
        OR data_hub_jobs.site = cs.data_hub_site_2
        OR data_hub_jobs.site = cs.data_hub_site_3
        OR data_hub_jobs.site = cs.data_hub_site_4
      )
  )
);