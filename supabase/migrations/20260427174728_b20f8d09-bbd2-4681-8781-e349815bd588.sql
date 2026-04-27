ALTER TABLE public.fuel_surcharge_rates
  ADD COLUMN customer_match TEXT;

COMMENT ON COLUMN public.fuel_surcharge_rates.customer_match IS
  'Optional case-insensitive substring of data_hub_jobs.customer. When set, this rate only applies to matching customers and overrides generic rates (zone is ignored).';

CREATE INDEX idx_fuel_rates_customer ON public.fuel_surcharge_rates(customer_match) WHERE customer_match IS NOT NULL AND active = true;

-- Seed Go Green Limited rates (zone stored as 'NA' since they're flat fees that ignore zone)
INSERT INTO public.fuel_surcharge_rates
  (effective_from_date, vehicle_category, zone, surcharge_amount, active, customer_match, notes)
VALUES
  ('2026-04-01', 'Skips', 'NA', 10.00, true, 'Go Green Limited', 'Customer-specific flat fuel surcharge (any zone, deliver/exchange/wait & load only)'),
  ('2026-04-01', 'RoRo',  'NA', 15.00, true, 'Go Green Limited', 'Customer-specific flat fuel surcharge (any zone, deliver/exchange/wait & load only)');