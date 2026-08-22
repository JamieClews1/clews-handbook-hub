CREATE TABLE public.hs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('site_induction','fire_safety')),
  reference_code text,
  title text NOT NULL,
  title_pl text, title_uk text, title_ro text,
  content text NOT NULL DEFAULT '',
  content_pl text, content_uk text, content_ro text,
  acknowledgements jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledgements_pl jsonb, acknowledgements_uk jsonb, acknowledgements_ro jsonb,
  user_types text[] NOT NULL DEFAULT '{}',
  site text,
  version text,
  is_published boolean NOT NULL DEFAULT true,
  requires_signature boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hs_documents TO authenticated;
GRANT ALL ON public.hs_documents TO service_role;
ALTER TABLE public.hs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view published H&S documents"
ON public.hs_documents FOR SELECT TO authenticated
USING (is_published OR public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));

CREATE POLICY "Admins manage H&S documents"
ON public.hs_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));

CREATE TRIGGER update_hs_documents_updated_at BEFORE UPDATE ON public.hs_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hs_document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.hs_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signature_image text NOT NULL,
  employee_name text,
  date_of_birth date,
  job_title text,
  inducted_by text,
  site text,
  language text NOT NULL DEFAULT 'EN',
  acknowledgements jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hs_document_signatures TO authenticated;
GRANT ALL ON public.hs_document_signatures TO service_role;
ALTER TABLE public.hs_document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own H&S signatures"
ON public.hs_document_signatures FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));

CREATE POLICY "Users sign H&S documents"
ON public.hs_document_signatures FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own H&S signature"
ON public.hs_document_signatures FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins delete H&S signatures"
ON public.hs_document_signatures FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_management(auth.uid()));