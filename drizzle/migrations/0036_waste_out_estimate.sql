ALTER TABLE public.route_one_jobs
  ADD COLUMN IF NOT EXISTS waste_out_estimate_type text,
  ADD COLUMN IF NOT EXISTS waste_out_estimate_per_tonne numeric;
COMMENT ON COLUMN public.route_one_jobs.waste_out_estimate_type IS 'Waste Out only: gate_fee (we pay) or rebate (we receive); indicative, never invoiced';