ALTER TABLE public.skip_inventory_condition_values
  ADD COLUMN IF NOT EXISTS size_group text,
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.skip_inventory_condition_values
  DROP CONSTRAINT IF EXISTS skip_inventory_condition_values_asset_type_condition_key;

CREATE UNIQUE INDEX IF NOT EXISTS skip_inventory_condition_values_unique_group
  ON public.skip_inventory_condition_values (asset_type, condition, COALESCE(size_group, ''));