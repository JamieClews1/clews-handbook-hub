CREATE POLICY "Finance staff read invoice files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff write invoice files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff update invoice files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_finance_user(auth.uid()))
  WITH CHECK (bucket_id = 'invoices' AND public.is_finance_user(auth.uid()));

CREATE POLICY "Finance staff delete invoice files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_finance_user(auth.uid()));