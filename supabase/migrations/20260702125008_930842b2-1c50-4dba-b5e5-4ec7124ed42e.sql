INSERT INTO rebate_monthly_values (item_id, month_start, lower_range, higher_range)
SELECT c.item_id, '2026-06-01', c.lo, c.hi FROM (VALUES
  ('2832c3c3-ee48-42af-8de0-4ab716c85de8'::uuid, 250, 350),
  ('0b336526-9a03-495b-be25-fbc2d317ecc5'::uuid, 20, 50),
  ('8fcef2c7-ceaa-4da1-a14e-a36916c3c7fe'::uuid, 130, 250),
  ('8dc76186-75f3-438e-b614-c9a608dc3e04'::uuid, 265, 360),
  ('6823fb6a-173f-48dc-948f-ddcf3b556401'::uuid, 370, 490)
) AS c(item_id, lo, hi)
ON CONFLICT (month_start, item_id) DO UPDATE SET lower_range = EXCLUDED.lower_range, higher_range = EXCLUDED.higher_range;