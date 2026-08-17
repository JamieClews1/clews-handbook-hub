CREATE TABLE public.wtn_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  job_number text,
  source text NOT NULL DEFAULT 'skiptrak',
  customer text,
  site text,
  job_date date,
  customer_name text,
  driver_name text,
  customer_signature_path text,
  driver_signature_path text,
  text_content text,
  parse_status text NOT NULL DEFAULT 'pending',
  parse_error text,
  parsed_at timestamptz,
  received_via text NOT NULL DEFAULT 'manual',
  email_from text,
  email_subject text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wtn_documents_job_number ON public.wtn_documents (job_number);
CREATE INDEX idx_wtn_documents_created_at ON public.wtn_documents (created_at DESC);
CREATE UNIQUE INDEX idx_wtn_documents_path ON public.wtn_documents (storage_path);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wtn_documents TO authenticated;
GRANT ALL ON public.wtn_documents TO service_role;
ALTER TABLE public.wtn_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view WTN documents" ON public.wtn_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add WTN documents" ON public.wtn_documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update WTN documents" ON public.wtn_documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete WTN documents" ON public.wtn_documents
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_wtn_documents_updated_at
  BEFORE UPDATE ON public.wtn_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wtn_document_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.wtn_documents(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'photo',
  page integer,
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wtn_document_images_doc ON public.wtn_document_images (document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wtn_document_images TO authenticated;
GRANT ALL ON public.wtn_document_images TO service_role;
ALTER TABLE public.wtn_document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view WTN images" ON public.wtn_document_images
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage WTN images" ON public.wtn_document_images
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can read WTN files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'wtn-documents');
CREATE POLICY "Staff can upload WTN files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wtn-documents');
CREATE POLICY "Staff can update WTN files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'wtn-documents');
CREATE POLICY "Staff can delete WTN files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'wtn-documents');