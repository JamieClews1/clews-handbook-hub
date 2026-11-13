-- Helper: is the user a customer portal member?
CREATE OR REPLACE FUNCTION public.is_portal_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customer_portal_memberships WHERE user_id = _user_id
  )
$$;

-- Helper: is the user a portal member of a Staci customer?
CREATE OR REPLACE FUNCTION public.is_staci_portal_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customer_portal_memberships m
    JOIN public.customers c ON c.id = m.customer_id
    WHERE m.user_id = _user_id AND lower(c.customer_name) LIKE '%staci%'
  )
$$;

-- Helper: can a portal user see a customer site?
CREATE OR REPLACE FUNCTION public.can_portal_user_access_site(_user_id uuid, _site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _site_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.customer_sites cs
      JOIN public.customer_portal_memberships m ON m.user_id = _user_id
      JOIN public.customers mc ON mc.id = m.customer_id
      WHERE cs.id = _site_id
        AND (
          EXISTS (SELECT 1 FROM public.customer_portal_site_access a WHERE a.membership_id = m.id AND a.site_id = cs.id)
          OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
          OR (COALESCE(mc.is_broker, false) AND cs.customer_id = m.customer_id)
        )
    )
    OR (
      public.user_has_reconomy_membership(_user_id) AND EXISTS (
        SELECT 1 FROM public.customer_sites cs
        JOIN public.customers c ON c.id = cs.customer_id
        WHERE cs.id = _site_id
          AND lower(c.customer_name) LIKE ANY (ARRAY['%reconomy (uk)%','%reconomy solutions%','%ama waste%','%circle waste%','%advanced waste solutions%','%ecofficiency%'])
      )
    )
  )
$$;

-- Helper: can a portal user see a load report (by its site, or by its linked ticket when no site is set)?
CREATE OR REPLACE FUNCTION public.can_portal_user_access_load_report(_user_id uuid, _report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.load_reports r
    WHERE r.id = _report_id
      AND (
        public.can_portal_user_access_site(_user_id, r.site_id)
        OR (
          r.site_id IS NULL AND NULLIF(btrim(r.notes), '') IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.data_hub_jobs j
            WHERE j.job_number = btrim(r.notes)
              AND public.can_portal_user_access_data_hub_job(_user_id, j.customer, j.site)
          )
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_portal_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staci_portal_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_portal_user_access_site(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_portal_user_access_load_report(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staci_portal_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_portal_user_access_site(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_portal_user_access_load_report(uuid, uuid) TO authenticated, service_role;

-- stock_reports: staff only
DROP POLICY IF EXISTS "Authenticated users can create stock reports" ON public.stock_reports;
DROP POLICY IF EXISTS "Authenticated users can view stock reports" ON public.stock_reports;
CREATE POLICY "Staff can create stock reports" ON public.stock_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can view stock reports" ON public.stock_reports FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- load_reports: staff create/read; portal users read reports for their sites
DROP POLICY IF EXISTS "Authenticated users can create load reports" ON public.load_reports;
DROP POLICY IF EXISTS "Authenticated users can view load reports" ON public.load_reports;
CREATE POLICY "Staff can create load reports" ON public.load_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can view load reports" ON public.load_reports FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Portal users can view load reports for their sites" ON public.load_reports FOR SELECT TO authenticated
  USING (public.can_portal_user_access_load_report(auth.uid(), id));

-- load_line_items: staff read; portal users read lines of reports they can see
DROP POLICY IF EXISTS "Authenticated users can view load line items" ON public.load_line_items;
CREATE POLICY "Staff can view load line items" ON public.load_line_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Portal users can view load line items for their sites" ON public.load_line_items FOR SELECT TO authenticated
  USING (public.can_portal_user_access_load_report(auth.uid(), load_report_id));

-- Settings/rules the customer portal needs for rebate maths: staff or portal members
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.load_report_settings;
CREATE POLICY "Staff and portal users can view load report settings" ON public.load_report_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_portal_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view rebate mappings" ON public.data_hub_rebate_mappings;
CREATE POLICY "Staff and portal users can view rebate mappings" ON public.data_hub_rebate_mappings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_portal_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view rebate rules" ON public.rebate_rules;
CREATE POLICY "Staff and portal users can view rebate rules" ON public.rebate_rules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_portal_member(auth.uid()));

-- Staci rates/charges: staff or Staci portal users
DROP POLICY IF EXISTS "Portal users can view staci pallet rates" ON public.staci_pallet_rates;
CREATE POLICY "Staff and Staci portal users can view staci pallet rates" ON public.staci_pallet_rates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_staci_portal_member(auth.uid()));

DROP POLICY IF EXISTS "Portal users can view staci pallet charges" ON public.staci_pallet_charges;
CREATE POLICY "Staff and Staci portal users can view staci pallet charges" ON public.staci_pallet_charges FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_staci_portal_member(auth.uid()));

-- Staff-only reads
DROP POLICY IF EXISTS "Authenticated users can view charge matrix" ON public.contamination_charge_matrix;
CREATE POLICY "Staff can view charge matrix" ON public.contamination_charge_matrix FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view live jobs settings" ON public.live_jobs_settings;
CREATE POLICY "Staff can view live jobs settings" ON public.live_jobs_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view points" ON public.contamination_points;
DROP POLICY IF EXISTS "Anon can insert points" ON public.contamination_points;
CREATE POLICY "Staff can view points" ON public.contamination_points FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view pricing settings" ON public.pricing_settings;
CREATE POLICY "Staff can view pricing settings" ON public.pricing_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view riddor incidents" ON public.riddor_incidents;
CREATE POLICY "Staff can view riddor incidents" ON public.riddor_incidents FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view partners" ON public.partners;
CREATE POLICY "Staff can view partners" ON public.partners FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view partner document requirements" ON public.partner_document_requirements;
CREATE POLICY "Staff can view partner document requirements" ON public.partner_document_requirements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view partner documents" ON public.partner_documents;
CREATE POLICY "Staff can view partner documents" ON public.partner_documents FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "All staff can view daily entries" ON public.stock_check_daily_entries;
CREATE POLICY "Staff can view daily entries" ON public.stock_check_daily_entries FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view stock email settings" ON public.stock_report_email_settings;
CREATE POLICY "Staff can view stock email settings" ON public.stock_report_email_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view document types" ON public.document_types;
CREATE POLICY "Staff can view document types" ON public.document_types FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "All staff can view container types" ON public.stock_check_container_types;
CREATE POLICY "Staff can view container types" ON public.stock_check_container_types FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view biffa fuel surcharge settings" ON public.biffa_fuel_surcharge_settings;
CREATE POLICY "Staff can view biffa fuel surcharge settings" ON public.biffa_fuel_surcharge_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view company documents" ON public.company_documents;
CREATE POLICY "Staff can view company documents" ON public.company_documents FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "All staff can view excluded sites" ON public.stock_check_excluded_sites;
CREATE POLICY "Staff can view excluded sites" ON public.stock_check_excluded_sites FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view midweigh product mappings" ON public.midweigh_product_mappings;
CREATE POLICY "Staff can view midweigh product mappings" ON public.midweigh_product_mappings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view company contacts" ON public.company_contacts;
CREATE POLICY "Staff can view company contacts" ON public.company_contacts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Contamination config: staff read (driver/yard apps read through driver-actions)
DROP POLICY IF EXISTS "Anyone can view pricing tiers" ON public.contamination_pricing_tiers;
CREATE POLICY "Staff can view pricing tiers" ON public.contamination_pricing_tiers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view waste types" ON public.contamination_waste_types;
CREATE POLICY "Staff can view contamination waste types" ON public.contamination_waste_types FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view charge items" ON public.contamination_charge_items;
CREATE POLICY "Staff can view charge items" ON public.contamination_charge_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view contamination settings" ON public.contamination_settings;
CREATE POLICY "Staff can view contamination settings" ON public.contamination_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view default waste types" ON public.default_waste_types;
CREATE POLICY "Staff can view default waste types" ON public.default_waste_types FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view HR contact settings" ON public.hr_contact_settings;
CREATE POLICY "Staff can view HR contact settings" ON public.hr_contact_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Near miss: public form stays open, but only as a fresh, unreviewed, well-formed report
DROP POLICY IF EXISTS "Anyone can submit near miss reports" ON public.near_miss_reports;
CREATE POLICY "Anyone can submit a new near miss report" ON public.near_miss_reports FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_notes IS NULL
    AND length(btrim(location)) BETWEEN 1 AND 500
    AND length(btrim(description)) BETWEEN 1 AND 10000
    AND length(btrim(what_happened)) BETWEEN 1 AND 10000
    AND coalesce(length(potential_consequences), 0) <= 10000
    AND coalesce(length(suggested_actions), 0) <= 10000
    AND coalesce(length(reporter_name), 0) <= 200
    AND coalesce(length(reporter_department), 0) <= 200
    AND report_date BETWEEN DATE '2000-01-01' AND (CURRENT_DATE + 1)
  );

-- Storage uploads: staff only
DROP POLICY IF EXISTS "Staff can upload permit documents" ON storage.objects;
CREATE POLICY "Staff can upload permit documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'permit-documents' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can upload POD files" ON storage.objects;
CREATE POLICY "Staff can upload POD files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pods' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can upload contamination photos" ON storage.objects;
CREATE POLICY "Staff can upload contamination photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contamination-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can upload weighbridge attachment files" ON storage.objects;
CREATE POLICY "Staff can upload weighbridge attachment files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weighbridge-attachments' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can upload rebate-reports" ON storage.objects;
CREATE POLICY "Staff can upload rebate-reports" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rebate-reports' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Allow public upload route-one-photos" ON storage.objects;
CREATE POLICY "Staff can upload route-one-photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'route-one-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can upload WTN files" ON storage.objects;
CREATE POLICY "Staff can upload WTN files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wtn-documents' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can write crm attachments" ON storage.objects;
CREATE POLICY "Staff can write crm attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can upload load photos" ON storage.objects;
CREATE POLICY "Staff can upload load photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'load-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can upload pricing attachments" ON storage.objects;
CREATE POLICY "Staff can upload pricing attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pricing-attachments' AND public.is_staff(auth.uid()));