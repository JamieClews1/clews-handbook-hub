-- Add load_report_type column to customer_sites to determine which materials appear for rebates
ALTER TABLE public.customer_sites 
ADD COLUMN IF NOT EXISTS load_report_type text NULL;

COMMENT ON COLUMN public.customer_sites.load_report_type IS 'The load report type (e.g., britvic, staci) that determines which waste types/materials are used for rebate configuration';