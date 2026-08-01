ALTER TABLE public.route_one_jobs
  ADD COLUMN IF NOT EXISTS haulage_cost numeric,
  ADD COLUMN IF NOT EXISTS charge_per_tonne numeric,
  ADD COLUMN IF NOT EXISTS min_weight_charge numeric,
  ADD COLUMN IF NOT EXISTS weight_included_t numeric,
  ADD COLUMN IF NOT EXISTS cost_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contamination_charge numeric,
  ADD COLUMN IF NOT EXISTS contamination_query_id uuid,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS total_net numeric,
  ADD COLUMN IF NOT EXISTS total_inc_vat numeric;

CREATE TABLE IF NOT EXISTS public.route_one_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_charge numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_cost_items TO authenticated;
GRANT ALL ON public.route_one_cost_items TO service_role;

ALTER TABLE public.route_one_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cost items"
  ON public.route_one_cost_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cost items"
  ON public.route_one_cost_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_route_one_cost_items_updated_at
  BEFORE UPDATE ON public.route_one_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.route_one_cost_items (name, default_charge, display_order)
SELECT * FROM (VALUES
  ('Wasted Journey', 0, 1),
  ('Wait Time (per hour)', 0, 2),
  ('Permit', 0, 3),
  ('Overweight Charge', 0, 4)
) AS v(name, default_charge, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.route_one_cost_items);