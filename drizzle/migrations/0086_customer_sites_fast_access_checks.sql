DROP POLICY IF EXISTS "Admin/management can manage customer sites" ON public.customer_sites;
DROP POLICY IF EXISTS "Authenticated users can view all sites for load reports" ON public.customer_sites;
DROP POLICY IF EXISTS "Portal users can view sites they have access to" ON public.customer_sites;

CREATE POLICY "Admin/management can manage customer sites"
ON public.customer_sites FOR ALL
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.is_management((SELECT auth.uid()))))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.is_management((SELECT auth.uid()))));

CREATE POLICY "Authenticated users can view all sites for load reports"
ON public.customer_sites FOR SELECT
USING ((SELECT public.is_staff((SELECT auth.uid()))));

CREATE POLICY "Portal users can view sites they have access to"
ON public.customer_sites FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.customer_portal_memberships m
  WHERE m.user_id = (SELECT auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.customer_portal_site_access a WHERE a.membership_id = m.id AND a.site_id = customer_sites.id)
      OR (m.contact_id IS NOT NULL AND m.contact_id = customer_sites.owner_contact_id)
    )
));