CREATE TABLE public.hs_document_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.hs_documents(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hs_document_share_links TO authenticated;
GRANT ALL ON public.hs_document_share_links TO service_role;
ALTER TABLE public.hs_document_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage share links" ON public.hs_document_share_links FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER update_hs_document_share_links_updated_at BEFORE UPDATE ON public.hs_document_share_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hs_document_guest_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.hs_documents(id) ON DELETE CASCADE,
  share_link_id UUID REFERENCES public.hs_document_share_links(id) ON DELETE SET NULL,
  signature_image TEXT NOT NULL,
  employee_name TEXT,
  date_of_birth DATE,
  job_title TEXT,
  inducted_by TEXT,
  site TEXT,
  language TEXT NOT NULL DEFAULT 'EN',
  acknowledgements JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.hs_document_guest_signatures TO authenticated;
GRANT ALL ON public.hs_document_guest_signatures TO service_role;
ALTER TABLE public.hs_document_guest_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view guest signatures" ON public.hs_document_guest_signatures FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete guest signatures" ON public.hs_document_guest_signatures FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));