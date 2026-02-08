-- Add wet charge percentage to load_reports (the discount percentage to apply)
ALTER TABLE public.load_reports 
ADD COLUMN wet_charge_percent numeric DEFAULT 0;

-- Add wet_charge_applied boolean to load_line_items to track which items have the charge applied
ALTER TABLE public.load_line_items 
ADD COLUMN wet_charge_applied boolean DEFAULT false;