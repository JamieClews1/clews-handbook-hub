-- Add adjustment column for per-line rebate adjustments (e.g., +£10 or -£20 per tonne)
ALTER TABLE public.rebate_price_set_items 
ADD COLUMN adjustment NUMERIC DEFAULT 0;