ALTER TABLE public.weighbridge_vehicles ADD COLUMN IF NOT EXISTS drivers text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.weighbridge_customers ADD COLUMN IF NOT EXISTS drivers text[] NOT NULL DEFAULT '{}';
CREATE TABLE public.weighbridge_driver_import (kind text, key text, drivers text[]);
GRANT ALL ON public.weighbridge_driver_import TO service_role;
ALTER TABLE public.weighbridge_driver_import ENABLE ROW LEVEL SECURITY;