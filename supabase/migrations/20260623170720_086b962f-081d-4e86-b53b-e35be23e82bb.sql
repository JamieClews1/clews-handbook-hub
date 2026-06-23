-- Allow staff (authenticated) to manage pricing email attachments; service role full access for edge functions
CREATE POLICY "Authenticated can read pricing attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pricing-attachments');

CREATE POLICY "Authenticated can upload pricing attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pricing-attachments');

CREATE POLICY "Authenticated can update pricing attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pricing-attachments')
WITH CHECK (bucket_id = 'pricing-attachments');

CREATE POLICY "Authenticated can delete pricing attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pricing-attachments');