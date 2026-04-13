
-- Portal users can view bookings for sites they have access to
CREATE POLICY "Portal users can view their bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT csa.site_id FROM customer_portal_site_access csa
      JOIN customer_portal_memberships cpm ON cpm.id = csa.membership_id
      WHERE cpm.user_id = auth.uid()
      UNION
      SELECT cs.id FROM customer_sites cs
      JOIN customer_portal_memberships cpm ON cpm.customer_id = cs.customer_id
      WHERE cpm.user_id = auth.uid()
        AND cs.owner_contact_id = cpm.contact_id
        AND cpm.contact_id IS NOT NULL
    )
  );

-- Portal users can create bookings for their sites
CREATE POLICY "Portal users can create bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    source = 'portal'
    AND site_id IN (
      SELECT csa.site_id FROM customer_portal_site_access csa
      JOIN customer_portal_memberships cpm ON cpm.id = csa.membership_id
      WHERE cpm.user_id = auth.uid()
      UNION
      SELECT cs.id FROM customer_sites cs
      JOIN customer_portal_memberships cpm ON cpm.customer_id = cs.customer_id
      WHERE cpm.user_id = auth.uid()
        AND cs.owner_contact_id = cpm.contact_id
        AND cpm.contact_id IS NOT NULL
    )
  );

-- Allow anonymous inserts for public booking form
CREATE POLICY "Public can create booking requests"
  ON public.bookings FOR INSERT TO anon
  WITH CHECK (source = 'public' AND status = 'pending');
