
ALTER TABLE public.finance_settings
  ADD COLUMN IF NOT EXISTS invoice_logo_url text,
  ADD COLUMN IF NOT EXISTS invoice_logo_width_mm numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS invoice_show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_company_address boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_bank_details boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_vat_breakdown boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_accent_color text NOT NULL DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS invoice_header_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS invoice_table_style text NOT NULL DEFAULT 'striped',
  ADD COLUMN IF NOT EXISTS invoice_font text NOT NULL DEFAULT 'helvetica',
  ADD COLUMN IF NOT EXISTS invoice_document_title text NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS invoice_footer_text text,
  ADD COLUMN IF NOT EXISTS invoice_terms_text text;
