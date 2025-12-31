-- Create questionnaire templates table
CREATE TABLE public.questionnaire_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create questionnaire sections table
CREATE TABLE public.questionnaire_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.questionnaire_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create questionnaire fields table
CREATE TABLE public.questionnaire_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.questionnaire_sections(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'checkbox', 'email', 'phone', 'select', 'date')),
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  options TEXT[], -- For select fields
  display_order INTEGER NOT NULL DEFAULT 0,
  helper_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add template_id to partner_questionnaires
ALTER TABLE public.partner_questionnaires 
ADD COLUMN template_id UUID REFERENCES public.questionnaire_templates(id) ON DELETE SET NULL;

-- Add responses JSON column to store dynamic field values
ALTER TABLE public.partner_questionnaires 
ADD COLUMN responses JSONB DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.questionnaire_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_fields ENABLE ROW LEVEL SECURITY;

-- Templates policies
CREATE POLICY "Admins can manage templates"
ON public.questionnaire_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates"
ON public.questionnaire_templates
FOR SELECT
USING (is_active = true);

-- Sections policies
CREATE POLICY "Admins can manage sections"
ON public.questionnaire_sections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view sections"
ON public.questionnaire_sections
FOR SELECT
USING (true);

-- Fields policies
CREATE POLICY "Admins can manage fields"
ON public.questionnaire_fields
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view fields"
ON public.questionnaire_fields
FOR SELECT
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_questionnaire_templates_updated_at
BEFORE UPDATE ON public.questionnaire_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questionnaire_sections_updated_at
BEFORE UPDATE ON public.questionnaire_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questionnaire_fields_updated_at
BEFORE UPDATE ON public.questionnaire_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default template based on original structure
INSERT INTO public.questionnaire_templates (name, description, is_default, is_active)
VALUES ('Partner Onboarding Questionnaire', 'Standard partner compliance questionnaire for waste management partners', true, true);

-- Get template ID for inserting sections
WITH template AS (
  SELECT id FROM public.questionnaire_templates WHERE is_default = true LIMIT 1
)
INSERT INTO public.questionnaire_sections (template_id, title, description, display_order)
SELECT 
  template.id,
  section.title,
  section.description,
  section.display_order
FROM template, (VALUES
  ('Company Details', 'Basic company information and registration details', 1),
  ('Services Summary', 'Services your company provides', 2),
  ('Supplier Compliance', 'Required compliance documents', 3),
  ('Health, Safety & Environment', 'SHEQ information and certifications', 4),
  ('Invoicing Information', 'Billing and reporting preferences', 5),
  ('Responsible Business', 'Corporate responsibility and policies', 6),
  ('Declaration', 'Signature and acknowledgement', 7)
) AS section(title, description, display_order);