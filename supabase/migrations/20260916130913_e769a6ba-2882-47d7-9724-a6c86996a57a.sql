ALTER TABLE public.permit_applications
  ADD COLUMN IF NOT EXISTS form_data JSONB,
  ADD COLUMN IF NOT EXISTS application_pdf_path TEXT;