
-- Weighbridge customers (sourced from Midweigh data)
CREATE TABLE public.weighbridge_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weighbridge_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weighbridge customers"
  ON public.weighbridge_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage weighbridge customers"
  ON public.weighbridge_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_weighbridge_customers_updated_at
  BEFORE UPDATE ON public.weighbridge_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weighbridge vehicles (sourced from Midweigh data)
CREATE TABLE public.weighbridge_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_reg TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weighbridge_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weighbridge vehicles"
  ON public.weighbridge_vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage weighbridge vehicles"
  ON public.weighbridge_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_weighbridge_vehicles_updated_at
  BEFORE UPDATE ON public.weighbridge_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Populate customers from Midweigh data
INSERT INTO public.weighbridge_customers (customer_name)
SELECT DISTINCT customer FROM public.data_hub_jobs
WHERE source = 'midweigh' AND customer IS NOT NULL AND customer != ''
ORDER BY customer
ON CONFLICT (customer_name) DO NOTHING;

-- Populate vehicles from Midweigh data
INSERT INTO public.weighbridge_vehicles (vehicle_reg)
SELECT DISTINCT UPPER(TRIM(vehicle_registration)) FROM public.data_hub_jobs
WHERE source = 'midweigh' AND vehicle_registration IS NOT NULL AND vehicle_registration != ''
ORDER BY UPPER(TRIM(vehicle_registration))
ON CONFLICT (vehicle_reg) DO NOTHING;
