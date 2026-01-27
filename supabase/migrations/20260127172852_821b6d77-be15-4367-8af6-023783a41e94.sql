
-- Add SELECT policies to allow portal users to view rebate configuration for their sites

-- Policy for customer_site_price_sets: portal users can view price sets for sites they have access to
CREATE POLICY "Portal users can view site price sets"
ON public.customer_site_price_sets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_memberships m
    JOIN customer_sites cs ON cs.customer_id = m.customer_id
    WHERE m.user_id = auth.uid()
    AND customer_site_price_sets.site_id = cs.id
    AND (
      EXISTS (
        SELECT 1 FROM customer_portal_site_access a
        WHERE a.membership_id = m.id AND a.site_id = cs.id
      )
      OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
    )
  )
);

-- Policy for rebate_price_sets: portal users can view price sets linked to their sites
CREATE POLICY "Portal users can view rebate price sets"
ON public.rebate_price_sets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_site_price_sets csps
    JOIN customer_sites cs ON cs.id = csps.site_id
    JOIN customer_portal_memberships m ON m.customer_id = cs.customer_id
    WHERE m.user_id = auth.uid()
    AND csps.price_set_id = rebate_price_sets.id
    AND (
      EXISTS (
        SELECT 1 FROM customer_portal_site_access a
        WHERE a.membership_id = m.id AND a.site_id = cs.id
      )
      OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
    )
  )
);

-- Policy for rebate_price_set_items: portal users can view items for price sets they can access
CREATE POLICY "Portal users can view rebate price set items"
ON public.rebate_price_set_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_site_price_sets csps
    JOIN customer_sites cs ON cs.id = csps.site_id
    JOIN customer_portal_memberships m ON m.customer_id = cs.customer_id
    WHERE m.user_id = auth.uid()
    AND csps.price_set_id = rebate_price_set_items.price_set_id
    AND (
      EXISTS (
        SELECT 1 FROM customer_portal_site_access a
        WHERE a.membership_id = m.id AND a.site_id = cs.id
      )
      OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
    )
  )
);
