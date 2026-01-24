-- Drop the foreign key constraint on rebate_price_set_items.rebate_item_id
-- This allows us to store load_waste_types.id instead of rebate_items.id
ALTER TABLE public.rebate_price_set_items 
DROP CONSTRAINT IF EXISTS rebate_price_set_items_rebate_item_id_fkey;