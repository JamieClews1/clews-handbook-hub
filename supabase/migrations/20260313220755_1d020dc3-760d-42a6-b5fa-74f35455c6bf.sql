ALTER TABLE public.load_waste_types ADD COLUMN rebate_category TEXT NOT NULL DEFAULT 'rebate';

UPDATE public.load_waste_types SET rebate_category = 'cost' WHERE waste_type IN ('Waste', 'Wood', 'Pallet Weight Charge');