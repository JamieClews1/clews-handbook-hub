-- Add no_pallets_on_load column to load_reports table
ALTER TABLE public.load_reports 
ADD COLUMN no_pallets_on_load boolean NOT NULL DEFAULT false;