
-- Add Staci-specific fields to load_reports
ALTER TABLE public.load_reports
  ADD COLUMN pallets_scrap_count integer DEFAULT 0,
  ADD COLUMN card_bales_count integer DEFAULT 0,
  ADD COLUMN card_bales_weight_kg numeric DEFAULT 0,
  ADD COLUMN films_bale_count integer DEFAULT 0,
  ADD COLUMN films_bale_weight_kg numeric DEFAULT 0;
