-- Add customer_type_filter column
ALTER TABLE public.load_waste_types
ADD COLUMN customer_type_filter text[] DEFAULT NULL;

-- Add Pallets of PET for Britvic
INSERT INTO public.load_waste_types (waste_type, default_avg_weight_kg, display_order, is_active, pallet_weight_kg, rebate_category, customer_type_filter)
VALUES
  ('Pallets of PET', 0, 200, true, 20, 'other', ARRAY['britvic']),
  ('Pallets of Cans', 0, 201, true, 20, 'other', ARRAY['britvic']);