DROP POLICY IF EXISTS "Portal users can view broker customer sites" ON public.customer_sites;
CREATE POLICY "Portal users can view broker customer sites" ON public.customer_sites
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customer_portal_memberships m
  JOIN public.customers c ON c.id = m.customer_id
  WHERE m.user_id = auth.uid() AND m.customer_id = customer_sites.customer_id AND COALESCE(c.is_broker,false) = true
));