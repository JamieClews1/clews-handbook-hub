-- Document types configuration table
CREATE TABLE public.document_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('company', 'partner')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Company legal documents table
CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  document_type_id UUID REFERENCES public.document_types(id) ON DELETE SET NULL,
  document_type_name TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_role TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  partner_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Partner document requirements configuration
CREATE TABLE public.partner_document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  requires_expiry BOOLEAN NOT NULL DEFAULT true,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partner_type, document_type)
);

-- Partner documents table
CREATE TABLE public.partner_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  expiry_date DATE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_types
CREATE POLICY "Authenticated users can view document types" ON public.document_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert document types" ON public.document_types
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update document types" ON public.document_types
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete document types" ON public.document_types
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for company_documents
CREATE POLICY "Authenticated users can view company documents" ON public.company_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert company documents" ON public.company_documents
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update company documents" ON public.company_documents
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete company documents" ON public.company_documents
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for partners
CREATE POLICY "Authenticated users can view partners" ON public.partners
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert partners" ON public.partners
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update partners" ON public.partners
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete partners" ON public.partners
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for partner_document_requirements
CREATE POLICY "Authenticated users can view partner document requirements" ON public.partner_document_requirements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert partner document requirements" ON public.partner_document_requirements
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update partner document requirements" ON public.partner_document_requirements
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete partner document requirements" ON public.partner_document_requirements
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for partner_documents
CREATE POLICY "Authenticated users can view partner documents" ON public.partner_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert partner documents" ON public.partner_documents
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update partner documents" ON public.partner_documents
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete partner documents" ON public.partner_documents
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_document_types_updated_at
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_documents_updated_at
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_document_requirements_updated_at
  BEFORE UPDATE ON public.partner_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_documents_updated_at
  BEFORE UPDATE ON public.partner_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default document types
INSERT INTO public.document_types (name, category) VALUES
  ('Insurance Certificate', 'company'),
  ('Operating Licence', 'company'),
  ('Environmental Permit', 'company'),
  ('Health & Safety Policy', 'company'),
  ('Waste Carrier Licence', 'partner'),
  ('Environmental Licence', 'partner'),
  ('Public Liability Insurance', 'partner'),
  ('Employers Liability Insurance', 'partner');

-- Insert default partner document requirements
INSERT INTO public.partner_document_requirements (partner_type, document_type, requires_expiry, is_mandatory) VALUES
  ('waste_carrier', 'Waste Carrier Licence', true, true),
  ('waste_carrier', 'Public Liability Insurance', true, true),
  ('disposal_site', 'Environmental Permit', true, true),
  ('disposal_site', 'Environmental Licence', true, true),
  ('broker', 'Waste Broker Registration', true, true),
  ('broker', 'Public Liability Insurance', true, false),
  ('haulier', 'Operators Licence', true, true),
  ('haulier', 'Public Liability Insurance', true, true);

-- Create storage bucket for duty of care documents
INSERT INTO storage.buckets (id, name, public) VALUES ('duty-of-care-documents', 'duty-of-care-documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can view duty of care documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'duty-of-care-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can upload duty of care documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'duty-of-care-documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update duty of care documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'duty-of-care-documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete duty of care documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'duty-of-care-documents' AND has_role(auth.uid(), 'admin'));