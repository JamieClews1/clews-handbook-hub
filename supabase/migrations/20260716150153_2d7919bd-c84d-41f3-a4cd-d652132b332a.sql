CREATE POLICY "Authenticated can read rebate-reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rebate-reports');

CREATE POLICY "Authenticated can upload rebate-reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rebate-reports');

CREATE POLICY "Authenticated can delete rebate-reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rebate-reports');