-- Rate groups
CREATE TABLE public.weighbridge_rate_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weighbridge_rate_groups TO authenticated;
GRANT ALL ON public.weighbridge_rate_groups TO service_role;
ALTER TABLE public.weighbridge_rate_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage weighbridge rate groups" ON public.weighbridge_rate_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_weighbridge_rate_groups_updated_at BEFORE UPDATE ON public.weighbridge_rate_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-group price overrides
CREATE TABLE public.weighbridge_rate_group_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_group_id uuid NOT NULL REFERENCES public.weighbridge_rate_groups(id) ON DELETE CASCADE,
  waste_type_id uuid NOT NULL REFERENCES public.weighbridge_waste_types(id) ON DELETE CASCADE,
  price_per_tonne numeric(10,2) NOT NULL DEFAULT 0,
  min_charge numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_group_id, waste_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weighbridge_rate_group_prices TO authenticated;
GRANT ALL ON public.weighbridge_rate_group_prices TO service_role;
ALTER TABLE public.weighbridge_rate_group_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage weighbridge rate group prices" ON public.weighbridge_rate_group_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_weighbridge_rate_group_prices_updated_at BEFORE UPDATE ON public.weighbridge_rate_group_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Additional item templates
CREATE TABLE public.weighbridge_item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ewc_code text,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weighbridge_item_templates TO authenticated;
GRANT ALL ON public.weighbridge_item_templates TO service_role;
ALTER TABLE public.weighbridge_item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage weighbridge item templates" ON public.weighbridge_item_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_weighbridge_item_templates_updated_at BEFORE UPDATE ON public.weighbridge_item_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Column additions
ALTER TABLE public.weighbridge_waste_types ADD COLUMN IF NOT EXISTS min_charge numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.weighbridge_customers
  ADD COLUMN IF NOT EXISTS rate_group_id uuid REFERENCES public.weighbridge_rate_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS carrier_registration text;
ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS rate_group_id uuid REFERENCES public.weighbridge_rate_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS min_charge numeric(10,2);