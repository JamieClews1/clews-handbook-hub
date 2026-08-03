CREATE TABLE public.pod_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  job_number text,
  customer text,
  site text,
  delivery_date date,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pod_documents TO authenticated;
GRANT ALL ON public.pod_documents TO service_role;

ALTER TABLE public.pod_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view PODs" ON public.pod_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add PODs" ON public.pod_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Staff can update PODs" ON public.pod_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete PODs" ON public.pod_documents FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_pod_documents_created_at ON public.pod_documents (created_at DESC);
CREATE INDEX idx_pod_documents_job_number ON public.pod_documents (job_number);

CREATE TRIGGER update_pod_documents_updated_at
BEFORE UPDATE ON public.pod_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can read POD files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pods');
CREATE POLICY "Staff can upload POD files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pods');
CREATE POLICY "Staff can update POD files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'pods');
CREATE POLICY "Staff can delete POD files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pods');