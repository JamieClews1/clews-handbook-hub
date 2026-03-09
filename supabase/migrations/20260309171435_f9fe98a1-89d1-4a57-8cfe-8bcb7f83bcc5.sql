-- Update February 2026 rebate prices from screenshots

-- Merchant Price Mixed Paper: 12 - 22
UPDATE public.rebate_monthly_values SET lower_range = 12, higher_range = 22, updated_at = now() WHERE id = '5f2c3ce9-75de-4f22-b920-ab1633b00442';

-- Merchant Price Card (old KLS): 30 - 50
UPDATE public.rebate_monthly_values SET lower_range = 30, higher_range = 50, updated_at = now() WHERE id = 'c32065ed-215b-41e1-aca0-b581794deac8';

-- Merchant Price White office paper: 55 - 62
UPDATE public.rebate_monthly_values SET lower_range = 55, higher_range = 62, updated_at = now() WHERE id = 'ab793c5b-3ed8-48f9-9aba-95c7cda8768b';

-- Domestic Price Mixed Paper: 35 - 62
UPDATE public.rebate_monthly_values SET lower_range = 35, higher_range = 62, updated_at = now() WHERE id = 'eec8cf7c-e56e-44b1-acc5-a6f847795593';

-- Domestic Price Card (old KLS): 75 - 90
UPDATE public.rebate_monthly_values SET lower_range = 75, higher_range = 90, updated_at = now() WHERE id = 'cd38ea77-759d-4b7f-92d9-77d48006b10a';

-- Ferrous Metal 5c Light iron: 60 - 100
UPDATE public.rebate_monthly_values SET lower_range = 60, higher_range = 100, updated_at = now() WHERE id = 'e06c0d68-84dc-4679-9cb1-5065c3177ed3';

-- Ferrous Metal 8b Mixed steel cuttings: 110 - 130
UPDATE public.rebate_monthly_values SET lower_range = 110, higher_range = 130, updated_at = now() WHERE id = 'fd0e681c-2d4a-41f9-9fba-b4a2a792166e';

-- 7B Turnings: 60 - 75
UPDATE public.rebate_monthly_values SET lower_range = 60, higher_range = 75, updated_at = now() WHERE id = 'ec1596af-ab57-494e-b75f-74ad925c2822';

-- Merchant Price News & Pams (from domestic screenshot News and pams): 75 - 100
UPDATE public.rebate_monthly_values SET lower_range = 75, higher_range = 100, updated_at = now() WHERE id = '65cf9ab3-4535-42e8-a6b3-de0495424ccd';