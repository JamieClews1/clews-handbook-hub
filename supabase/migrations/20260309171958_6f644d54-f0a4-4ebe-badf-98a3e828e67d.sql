-- Add "on pallets" boolean flags for each bale/dolav type
ALTER TABLE public.load_reports 
ADD COLUMN card_bales_on_pallets boolean NOT NULL DEFAULT false,
ADD COLUMN films_bale_on_pallets boolean NOT NULL DEFAULT false,
ADD COLUMN papers_dolav_on_pallets boolean NOT NULL DEFAULT false,
ADD COLUMN glass_dolav_on_pallets boolean NOT NULL DEFAULT false,
ADD COLUMN scrap_metal_loose_on_pallets boolean NOT NULL DEFAULT false;