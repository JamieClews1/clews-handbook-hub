UPDATE public.stock_check_container_types
SET data_hub_keywords = ARRAY['25 Yard','30 Yard','25Yd','30Yd','25 yd','30 yd']
WHERE name = '25/30yd' AND category = 'roro';

UPDATE public.stock_check_container_types
SET data_hub_keywords = ARRAY['35 Yard','40 Yard','35Yd','40Yd','35 yd','40 yd']
WHERE name = '35/40yd' AND category = 'roro';

UPDATE public.stock_check_container_types
SET data_hub_keywords = ARRAY['20 Yard','20Yd','20 yd']
WHERE name = '20yd' AND category = 'roro';