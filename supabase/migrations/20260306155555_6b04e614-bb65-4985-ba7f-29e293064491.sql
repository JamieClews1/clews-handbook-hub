
-- Add extra columns to route_one_drivers
ALTER TABLE public.route_one_drivers
  ADD COLUMN IF NOT EXISTS driver_number integer,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS department integer,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Skips';

-- Insert vehicles, skip if already exists
INSERT INTO public.route_one_vehicles (registration, vehicle_type)
SELECT v.registration, v.vehicle_type
FROM (VALUES
  ('AV20OAU', 'Skip'),
  ('BF67OPZ', 'Skip'),
  ('BV21UBC', 'Skip'),
  ('BV72 OCA', 'Skip'),
  ('SN71 ZKD', 'Skip'),
  ('FJ18FDM', 'Skip'),
  ('MX09BYU', 'Skip'),
  ('AY22 UUO', 'Skip')
) AS v(registration, vehicle_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.route_one_vehicles rv WHERE rv.registration = v.registration
);

-- Clear existing drivers to seed fresh
DELETE FROM public.route_one_drivers;

-- Insert drivers with vehicle references
INSERT INTO public.route_one_drivers (driver_name, driver_number, mobile, department, category, display_order, vehicle_id)
VALUES
  ('Grzegorz Nawrocki', 3, '07975995455', 30, 'Skips', 1, (SELECT id FROM public.route_one_vehicles WHERE registration = 'AV20OAU' LIMIT 1)),
  ('Lee Gane', 31, '07975995644', 52, 'Ro Ro', 2, (SELECT id FROM public.route_one_vehicles WHERE registration = 'BF67OPZ' LIMIT 1)),
  ('David Neal', 14, '07384513033', 22, 'Skips', 3, (SELECT id FROM public.route_one_vehicles WHERE registration = 'BF67OPZ' LIMIT 1)),
  ('Ricky Davis', 6, '07975995388', 32, 'Ro Ro', 4, (SELECT id FROM public.route_one_vehicles WHERE registration = 'BV21UBC' LIMIT 1)),
  ('Bartosz Karczewski', 30, '07975995695', 43, 'Ro Ro', 5, (SELECT id FROM public.route_one_vehicles WHERE registration = 'BV72 OCA' LIMIT 1)),
  ('Bheki Nhlanghoti', 17, NULL, 22, 'Ro Ro', 6, (SELECT id FROM public.route_one_vehicles WHERE registration = 'SN71 ZKD' LIMIT 1)),
  ('Jaroslaw Zaremba', 8, '07975995477', 52, 'Skips', 7, (SELECT id FROM public.route_one_vehicles WHERE registration = 'FJ18FDM' LIMIT 1)),
  ('Reginald Preece', 12, NULL, 28, 'Other', 8, (SELECT id FROM public.route_one_vehicles WHERE registration = 'MX09BYU' LIMIT 1)),
  ('John Edgar', 13, '07384513033', 40, 'Skips', 9, (SELECT id FROM public.route_one_vehicles WHERE registration = 'BF67OPZ' LIMIT 1)),
  ('Simon Bailey', 20, '07384254882', 40, 'Skips', 11, (SELECT id FROM public.route_one_vehicles WHERE registration = 'AY22 UUO' LIMIT 1));
