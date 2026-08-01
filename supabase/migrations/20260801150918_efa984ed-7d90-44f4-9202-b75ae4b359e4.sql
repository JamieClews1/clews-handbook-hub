CREATE TABLE public.route_one_job_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_job_types TO authenticated;
GRANT ALL ON public.route_one_job_types TO service_role;
ALTER TABLE public.route_one_job_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view job types" ON public.route_one_job_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage job types" ON public.route_one_job_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_route_one_job_types_updated_at
  BEFORE UPDATE ON public.route_one_job_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.route_one_container_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_container_types TO authenticated;
GRANT ALL ON public.route_one_container_types TO service_role;
ALTER TABLE public.route_one_container_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view container types" ON public.route_one_container_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage container types" ON public.route_one_container_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_route_one_container_types_updated_at
  BEFORE UPDATE ON public.route_one_container_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.route_one_job_types (key, label, color, display_order) VALUES
  ('delivery', 'Deliver', 'emerald', 1),
  ('exchange', 'Exchange', 'amber', 2),
  ('tip_return', 'Tip & Return', 'violet', 3),
  ('waste_truck', 'Waste Truck', 'blue', 4),
  ('pickup', 'Pickup', 'orange', 5),
  ('seven_five_tonne', '7.5 Tonne', 'cyan', 6)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.route_one_container_types (name, display_order)
SELECT btrim(container_type), row_number() OVER (ORDER BY count(*) DESC)
FROM public.data_hub_jobs
WHERE container_type IS NOT NULL
  AND btrim(container_type) <> ''
  AND upper(btrim(container_type)) NOT IN ('WASTEIN','WASTEOUT')
GROUP BY btrim(container_type)
ON CONFLICT (name) DO NOTHING;