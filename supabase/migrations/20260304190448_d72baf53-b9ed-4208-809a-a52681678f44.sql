
-- RouteOne: Vehicles
CREATE TABLE public.route_one_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL,
  make_model TEXT,
  tare_weight_kg NUMERIC,
  vehicle_type TEXT NOT NULL DEFAULT 'Skip',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RouteOne: Drivers
CREATE TABLE public.route_one_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name TEXT NOT NULL,
  vehicle_id UUID REFERENCES public.route_one_vehicles(id) ON DELETE SET NULL,
  user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job type enum
CREATE TYPE public.route_one_job_type AS ENUM (
  'delivery', 'exchange', 'collection', 'waste_truck', 'wasted_journey'
);

-- Job status enum
CREATE TYPE public.route_one_job_status AS ENUM (
  'unassigned', 'assigned', 'in_progress', 'completed', 'query'
);

-- RouteOne: Jobs
CREATE TABLE public.route_one_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL DEFAULT ('RO-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0')),
  customer_name TEXT NOT NULL,
  site_name TEXT,
  site_address TEXT,
  site_postcode TEXT,
  job_type public.route_one_job_type NOT NULL DEFAULT 'delivery',
  status public.route_one_job_status NOT NULL DEFAULT 'unassigned',
  container_type TEXT,
  container_size TEXT,
  waste_type TEXT,
  ewc_code TEXT,
  assigned_driver_id UUID REFERENCES public.route_one_drivers(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time TIME,
  estimated_duration_mins INT DEFAULT 60,
  display_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  query_reason TEXT,
  po_number TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.route_one_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_one_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_one_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies: staff can do everything (they pass StaffRoute guard)
CREATE POLICY "Staff can manage vehicles" ON public.route_one_vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Staff can manage drivers" ON public.route_one_drivers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Staff can manage jobs" ON public.route_one_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- Updated_at triggers
CREATE TRIGGER update_route_one_vehicles_updated_at
  BEFORE UPDATE ON public.route_one_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_one_drivers_updated_at
  BEFORE UPDATE ON public.route_one_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_one_jobs_updated_at
  BEFORE UPDATE ON public.route_one_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_one_jobs;
