-- Add value_type and set_value columns to rebate_price_set_items
-- value_type: 'lower' uses lower_range from monthly values, 'higher' uses higher_range, 'set' uses custom set_value
ALTER TABLE public.rebate_price_set_items 
ADD COLUMN IF NOT EXISTS value_type text NOT NULL DEFAULT 'lower' CHECK (value_type IN ('lower', 'higher', 'set')),
ADD COLUMN IF NOT EXISTS set_value numeric NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.rebate_price_set_items.value_type IS 'Determines which value to use: lower (lower_range), higher (higher_range), or set (custom set_value)';
COMMENT ON COLUMN public.rebate_price_set_items.set_value IS 'Custom fixed value when value_type is set';