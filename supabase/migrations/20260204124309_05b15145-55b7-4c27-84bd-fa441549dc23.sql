-- Add pallets_out column for EVRi reports (empty pallets loaded on way out)
ALTER TABLE public.load_reports 
ADD COLUMN pallets_out INTEGER DEFAULT 0;