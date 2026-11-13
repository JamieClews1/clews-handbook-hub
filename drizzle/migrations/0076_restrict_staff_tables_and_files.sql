-- stock_report_items: staff only
DROP POLICY IF EXISTS "Authenticated users can delete stock report items" ON public.stock_report_items;
DROP POLICY IF EXISTS "Authenticated users can update stock report items" ON public.stock_report_items;
DROP POLICY IF EXISTS "Authenticated users can create stock report items" ON public.stock_report_items;
DROP POLICY IF EXISTS "Authenticated users can view stock report items" ON public.stock_report_items;
CREATE POLICY "Staff manage stock report items" ON public.stock_report_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- load_report_exclusions: staff only
DROP POLICY IF EXISTS "Authenticated users can delete load report exclusions" ON public.load_report_exclusions;
DROP POLICY IF EXISTS "Authenticated users can create load report exclusions" ON public.load_report_exclusions;
DROP POLICY IF EXISTS "Authenticated users can view load report exclusions" ON public.load_report_exclusions;
CREATE POLICY "Staff manage load report exclusions" ON public.load_report_exclusions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- stock_check_items: staff only
DROP POLICY IF EXISTS "Staff can manage stock check items" ON public.stock_check_items;
DROP POLICY IF EXISTS "All staff can view stock check items" ON public.stock_check_items;
CREATE POLICY "Staff manage stock check items" ON public.stock_check_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- stock_checks: staff only (admin delete/update policies unchanged)
DROP POLICY IF EXISTS "Staff can update stock checks" ON public.stock_checks;
DROP POLICY IF EXISTS "All staff can create stock checks" ON public.stock_checks;
DROP POLICY IF EXISTS "All staff can view stock checks" ON public.stock_checks;
CREATE POLICY "Staff can view stock checks" ON public.stock_checks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create stock checks" ON public.stock_checks FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update stock checks" ON public.stock_checks FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- partner_questionnaires: staff read
DROP POLICY IF EXISTS "Authenticated users can view questionnaires" ON public.partner_questionnaires;
CREATE POLICY "Staff can view questionnaires" ON public.partner_questionnaires FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- contamination_activity_log: staff read
DROP POLICY IF EXISTS "Authenticated users can view contamination activity log" ON public.contamination_activity_log;
CREATE POLICY "Staff can view contamination activity log" ON public.contamination_activity_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- contamination_queries: staff read; drivers now write through the driver-actions function
DROP POLICY IF EXISTS "Authenticated users can view contamination queries" ON public.contamination_queries;
DROP POLICY IF EXISTS "Anon can update contamination queries" ON public.contamination_queries;
DROP POLICY IF EXISTS "Anon can insert contamination queries" ON public.contamination_queries;
CREATE POLICY "Staff can view contamination queries" ON public.contamination_queries FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- customer_skip_rebates: staff manage; portal users read their own customer's rules
DROP POLICY IF EXISTS "Authenticated users can delete customer skip rebates" ON public.customer_skip_rebates;
DROP POLICY IF EXISTS "Authenticated users can insert customer skip rebates" ON public.customer_skip_rebates;
DROP POLICY IF EXISTS "Authenticated users can update customer skip rebates" ON public.customer_skip_rebates;
DROP POLICY IF EXISTS "Authenticated users can view customer skip rebates" ON public.customer_skip_rebates;
CREATE POLICY "Staff manage customer skip rebates" ON public.customer_skip_rebates FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Portal users view their customer skip rebates" ON public.customer_skip_rebates FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.customer_portal_memberships m
            WHERE m.user_id = auth.uid() AND m.customer_id = customer_skip_rebates.customer_id)
    OR (public.user_has_reconomy_membership(auth.uid()) AND EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = customer_skip_rebates.customer_id
            AND lower(c.customer_name) LIKE ANY (ARRAY['%reconomy (uk)%','%reconomy solutions%','%ama waste%','%circle waste%','%advanced waste solutions%','%ecofficiency%'])))
  );

-- skip_tracker_settings: no anonymous reads (driver app reads via driver-actions)
DROP POLICY IF EXISTS "Anyone can read skip tracker settings" ON public.skip_tracker_settings;

-- verified_tipping_sites: staff only
DROP POLICY IF EXISTS "Staff can delete verified tipping sites" ON public.verified_tipping_sites;
DROP POLICY IF EXISTS "Staff can update verified tipping sites" ON public.verified_tipping_sites;
DROP POLICY IF EXISTS "Staff can add verified tipping sites" ON public.verified_tipping_sites;
DROP POLICY IF EXISTS "Staff can read verified tipping sites" ON public.verified_tipping_sites;
CREATE POLICY "Staff manage verified tipping sites" ON public.verified_tipping_sites FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- test_mode_settings: staff only
DROP POLICY IF EXISTS "Staff manage test mode" ON public.test_mode_settings;
DROP POLICY IF EXISTS "Staff view test mode" ON public.test_mode_settings;
CREATE POLICY "Staff view test mode" ON public.test_mode_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage test mode" ON public.test_mode_settings FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Storage: staff-only read/replace/delete on internal buckets
DROP POLICY IF EXISTS "Users can delete their own load photos" ON storage.objects;
CREATE POLICY "Users can delete their own load photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'load-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Allow public delete route-one-photos" ON storage.objects;
CREATE POLICY "Staff can delete route-one-photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'route-one-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete POD files" ON storage.objects;
CREATE POLICY "Staff can delete POD files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pods' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can update POD files" ON storage.objects;
CREATE POLICY "Staff can update POD files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pods' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'pods' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can read POD files" ON storage.objects;
CREATE POLICY "Staff can read POD files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pods' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read weighbridge attachment files" ON storage.objects;
CREATE POLICY "Staff can read weighbridge attachment files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'weighbridge-attachments' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can update weighbridge attachment files" ON storage.objects;
CREATE POLICY "Staff can update weighbridge attachment files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'weighbridge-attachments' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'weighbridge-attachments' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can delete weighbridge attachment files" ON storage.objects;
CREATE POLICY "Staff can delete weighbridge attachment files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'weighbridge-attachments' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can delete rebate-reports" ON storage.objects;
CREATE POLICY "Staff can delete rebate-reports" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rebate-reports' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can read rebate-reports" ON storage.objects;
CREATE POLICY "Staff can read rebate-reports" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rebate-reports' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can read crm attachments" ON storage.objects;
CREATE POLICY "Staff can read crm attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-attachments' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can delete crm attachments" ON storage.objects;
CREATE POLICY "Staff can delete crm attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-attachments' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view duty of care documents" ON storage.objects;
CREATE POLICY "Staff can view duty of care documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'duty-of-care-documents' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can update pricing attachments" ON storage.objects;
CREATE POLICY "Staff can update pricing attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pricing-attachments' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'pricing-attachments' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can delete pricing attachments" ON storage.objects;
CREATE POLICY "Staff can delete pricing attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pricing-attachments' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can read pricing attachments" ON storage.objects;
CREATE POLICY "Staff can read pricing attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pricing-attachments' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update permit documents" ON storage.objects;
CREATE POLICY "Staff can update permit documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'permit-documents' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'permit-documents' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can read permit documents" ON storage.objects;
CREATE POLICY "Staff can read permit documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'permit-documents' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete WTN files" ON storage.objects;
CREATE POLICY "Staff can delete WTN files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wtn-documents' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can update WTN files" ON storage.objects;
CREATE POLICY "Staff can update WTN files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wtn-documents' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'wtn-documents' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can read WTN files" ON storage.objects;
CREATE POLICY "Staff can read WTN files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wtn-documents' AND public.is_staff(auth.uid()));