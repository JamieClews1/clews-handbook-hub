CREATE POLICY "Portal users can view rebate monthly values" ON public.rebate_monthly_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_memberships m WHERE m.user_id = auth.uid()));
CREATE POLICY "Portal users can view rebate items" ON public.rebate_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_memberships m WHERE m.user_id = auth.uid()));
CREATE POLICY "Portal users can view their site rebate overrides" ON public.customer_site_rebate_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_memberships m JOIN public.customer_sites cs ON cs.customer_id = m.customer_id
    WHERE m.user_id = auth.uid() AND cs.id = customer_site_rebate_overrides.site_id));
CREATE POLICY "Portal users can view their site skip rebates" ON public.customer_site_skip_rebates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_memberships m JOIN public.customer_sites cs ON cs.customer_id = m.customer_id
    WHERE m.user_id = auth.uid() AND cs.id = customer_site_skip_rebates.site_id));