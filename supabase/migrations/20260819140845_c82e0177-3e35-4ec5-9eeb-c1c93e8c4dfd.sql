CREATE POLICY "Staff can read crm attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-attachments');

CREATE POLICY "Staff can write crm attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments');

CREATE POLICY "Staff can delete crm attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-attachments');