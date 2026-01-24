-- Add value_type_item_id column to rebate_price_set_items
-- This will store the reference to rebate_items.id (the "value type" like "OLD KLS merchant")
-- The existing rebate_item_id column stores the material reference (load_waste_types.id)
ALTER TABLE public.rebate_price_set_items 
ADD COLUMN IF NOT EXISTS value_type_item_id uuid NULL;

COMMENT ON COLUMN public.rebate_price_set_items.value_type_item_id IS 'References rebate_items.id - the value type (e.g., OLD KLS merchant, Domestic Price Card)';
COMMENT ON COLUMN public.rebate_price_set_items.rebate_item_id IS 'References load_waste_types.id - the material (e.g., Card Bales, Plastic Film)';