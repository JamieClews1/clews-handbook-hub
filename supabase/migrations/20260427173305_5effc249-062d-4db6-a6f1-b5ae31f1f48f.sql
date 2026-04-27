-- Fuel surcharge rates table (historical, never overwrite)
CREATE TABLE public.fuel_surcharge_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  effective_from_date DATE NOT NULL,
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('Weighbridge Tip','Skips','RoRo','Artic')),
  zone TEXT NOT NULL CHECK (zone IN ('NA','Zone 1','Zone 2','Zone 3')),
  surcharge_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fuel_rates_lookup ON public.fuel_surcharge_rates(vehicle_category, zone, effective_from_date DESC) WHERE active = true;

ALTER TABLE public.fuel_surcharge_rates ENABLE ROW LEVEL SECURITY;

-- Any authenticated staff can read
CREATE POLICY "Authenticated users can view fuel surcharge rates"
  ON public.fuel_surcharge_rates FOR SELECT
  TO authenticated USING (true);

-- Only management/admin can write
CREATE POLICY "Management can insert fuel surcharge rates"
  ON public.fuel_surcharge_rates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management can update fuel surcharge rates"
  ON public.fuel_surcharge_rates FOR UPDATE
  TO authenticated
  USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management can delete fuel surcharge rates"
  ON public.fuel_surcharge_rates FOR DELETE
  TO authenticated
  USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fuel_surcharge_rates_updated_at
  BEFORE UPDATE ON public.fuel_surcharge_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with rates from the supplied table, effective 1 April 2026
INSERT INTO public.fuel_surcharge_rates (effective_from_date, vehicle_category, zone, surcharge_amount, active, notes) VALUES
  ('2026-04-01','Weighbridge Tip','NA',     3.10, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Skips',          'Zone 1', 4.43, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Skips',          'Zone 2', 6.53, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Skips',          'Zone 3', 8.44, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','RoRo',           'Zone 1', 4.95, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','RoRo',           'Zone 2', 7.87, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','RoRo',           'Zone 3',11.58, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Artic',          'Zone 1', 5.57, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Artic',          'Zone 2', 9.46, true, 'Initial fuel surcharge schedule'),
  ('2026-04-01','Artic',          'Zone 3',14.41, true, 'Initial fuel surcharge schedule');