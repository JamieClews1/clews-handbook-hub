CREATE POLICY "Finance staff read payroll timesheet files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payroll-timesheets' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff upload payroll timesheet files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payroll-timesheets' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff update payroll timesheet files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payroll-timesheets' AND public.is_finance_user(auth.uid()))
  WITH CHECK (bucket_id = 'payroll-timesheets' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff delete payroll timesheet files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payroll-timesheets' AND public.is_finance_user(auth.uid()));