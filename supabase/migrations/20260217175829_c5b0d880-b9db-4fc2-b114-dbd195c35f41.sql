
-- Allow portal users (authenticated) to view staci pallet rates (read-only)
CREATE POLICY "Portal users can view staci pallet rates"
ON public.staci_pallet_rates
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow portal users (authenticated) to view staci pallet charges (read-only)
CREATE POLICY "Portal users can view staci pallet charges"
ON public.staci_pallet_charges
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow portal users to view data_hub_jobs matching their customer by customer name
-- This covers haulage jobs that may not have a matching site but DO match the customer
CREATE POLICY "Portal users can view jobs for their customer"
ON public.data_hub_jobs
FOR SELECT
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
      AND cs.data_hub_customer IS NOT NULL
      AND data_hub_jobs.customer = cs.data_hub_customer
  )
);
