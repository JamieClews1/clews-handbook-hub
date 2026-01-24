-- Add site_id column to load_reports to link reports to customer sites
ALTER TABLE public.load_reports 
ADD COLUMN site_id UUID REFERENCES public.customer_sites(id);

-- Create index for faster lookups
CREATE INDEX idx_load_reports_site_id ON public.load_reports(site_id);
CREATE INDEX idx_load_reports_report_date ON public.load_reports(report_date);