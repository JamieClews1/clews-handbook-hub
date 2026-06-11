ALTER TABLE public.load_reports
  ADD COLUMN IF NOT EXISTS rebate_threshold_tonnes numeric NOT NULL DEFAULT 0;

ALTER TABLE public.load_line_items
  ADD COLUMN IF NOT EXISTS rebate_threshold_applied boolean NOT NULL DEFAULT false;