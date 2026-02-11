
ALTER TABLE public.load_reports
ADD COLUMN papers_dolav_count integer DEFAULT 0,
ADD COLUMN papers_dolav_weight_kg numeric DEFAULT 0,
ADD COLUMN glass_dolav_count integer DEFAULT 0,
ADD COLUMN glass_dolav_weight_kg numeric DEFAULT 0;
