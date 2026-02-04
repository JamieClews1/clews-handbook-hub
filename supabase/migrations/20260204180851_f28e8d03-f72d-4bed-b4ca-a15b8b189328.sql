-- Add material_type_id column to data_hub_rebate_mappings
-- This links waste descriptions to material types from load_waste_types (used in Customer Setup)

ALTER TABLE public.data_hub_rebate_mappings
ADD COLUMN material_type_id UUID REFERENCES public.load_waste_types(id) ON DELETE SET NULL;