-- Drop the existing portal user site access policy
DROP POLICY IF EXISTS "Portal users can view sites they have access to" ON public.customer_sites;

-- Create updated policy that grants access either through:
-- 1. Explicit site access entries in customer_portal_site_access, OR
-- 2. Being the owner_contact of the site (via contact_id link in membership)
CREATE POLICY "Portal users can view sites they have access to"
ON public.customer_sites
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    WHERE m.user_id = auth.uid()
    AND (
      -- Explicit site access
      EXISTS (
        SELECT 1
        FROM public.customer_portal_site_access a
        WHERE a.membership_id = m.id
          AND a.site_id = customer_sites.id
      )
      OR
      -- User is the owner contact of this site
      (m.contact_id IS NOT NULL AND m.contact_id = customer_sites.owner_contact_id)
    )
  )
);