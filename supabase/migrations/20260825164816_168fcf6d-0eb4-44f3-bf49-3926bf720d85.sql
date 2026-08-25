CREATE TABLE public.weighbridge_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.weighbridge_transactions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  file_size integer,
  kind text NOT NULL DEFAULT 'photo',
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_weighbridge_attachments_tx ON public.weighbridge_attachments(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weighbridge_attachments TO authenticated;
GRANT ALL ON public.weighbridge_attachments TO service_role;

ALTER TABLE public.weighbridge_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view weighbridge attachments"
  ON public.weighbridge_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add weighbridge attachments"
  ON public.weighbridge_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update weighbridge attachments"
  ON public.weighbridge_attachments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete weighbridge attachments"
  ON public.weighbridge_attachments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Staff can read weighbridge attachment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'weighbridge-attachments');
CREATE POLICY "Staff can upload weighbridge attachment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weighbridge-attachments');
CREATE POLICY "Staff can update weighbridge attachment files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'weighbridge-attachments');
CREATE POLICY "Staff can delete weighbridge attachment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'weighbridge-attachments');