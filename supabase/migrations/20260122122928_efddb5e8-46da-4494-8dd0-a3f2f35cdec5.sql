-- Rebate values (monthly ranges for predetermined recyclables)

CREATE TABLE IF NOT EXISTS public.rebate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rebate_monthly_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start date NOT NULL,
  item_id uuid NOT NULL REFERENCES public.rebate_items(id) ON DELETE CASCADE,
  lower_range numeric,
  higher_range numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rebate_monthly_values_month_item_unique UNIQUE (month_start, item_id)
);

CREATE INDEX IF NOT EXISTS idx_rebate_monthly_values_month_start ON public.rebate_monthly_values(month_start);
CREATE INDEX IF NOT EXISTS idx_rebate_monthly_values_item_id ON public.rebate_monthly_values(item_id);

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_rebate_items_updated_at ON public.rebate_items;
CREATE TRIGGER update_rebate_items_updated_at
BEFORE UPDATE ON public.rebate_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rebate_monthly_values_updated_at ON public.rebate_monthly_values;
CREATE TRIGGER update_rebate_monthly_values_updated_at
BEFORE UPDATE ON public.rebate_monthly_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.rebate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebate_monthly_values ENABLE ROW LEVEL SECURITY;

-- Policies: any authenticated user can view; only admin or management can edit.
DROP POLICY IF EXISTS "Rebate items are viewable by authenticated users" ON public.rebate_items;
CREATE POLICY "Rebate items are viewable by authenticated users"
ON public.rebate_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Rebate items editable by admin or management" ON public.rebate_items;
CREATE POLICY "Rebate items editable by admin or management"
ON public.rebate_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

DROP POLICY IF EXISTS "Rebate values are viewable by authenticated users" ON public.rebate_monthly_values;
CREATE POLICY "Rebate values are viewable by authenticated users"
ON public.rebate_monthly_values
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Rebate values editable by admin or management" ON public.rebate_monthly_values;
CREATE POLICY "Rebate values editable by admin or management"
ON public.rebate_monthly_values
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

-- Seed the predetermined set (safe to run repeatedly)
INSERT INTO public.rebate_items (name, sort_order)
VALUES
  ('Merchant Price Card (old KLS)', 10),
  ('Merchant Price Mixed Paper', 20),
  ('Merchant Price News & Pams', 30),
  ('Merchant Price White office paper', 40),
  ('Domestic Price Card (old KLS)', 50),
  ('Domestic Price Mixed Paper', 60),
  ('Export Price 98:2', 70),
  ('Export Price 95:5', 80),
  ('Export Price 90:10', 90),
  ('Export Price 80:20', 100),
  ('Ferrous Metal 5c Light iron', 110),
  ('Ferrous Metal 8b Mixed steel cuttings', 120),
  ('Non-Ferrous Old rolled aluminium', 130),
  ('7B Turnings', 140),
  ('UK PE Printed Poly Bales', 150)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;