ALTER TABLE public.skip_inventory ADD COLUMN IF NOT EXISTS size text;

CREATE TABLE public.skip_inventory_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'skip',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, asset_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_inventory_sizes TO authenticated;
GRANT ALL ON public.skip_inventory_sizes TO service_role;

ALTER TABLE public.skip_inventory_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inventory sizes"
ON public.skip_inventory_sizes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage inventory sizes"
ON public.skip_inventory_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_skip_inventory_sizes_updated_at
BEFORE UPDATE ON public.skip_inventory_sizes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.skip_inventory_sizes (name, asset_type, display_order) VALUES
  ('40 CU YD', 'roro', 1),
  ('35 CU YD', 'roro', 2),
  ('30 CU YD', 'roro', 3),
  ('25 CU YD', 'roro', 4),
  ('20 CU YD', 'roro', 5),
  ('40 CU YD COMPACTOR', 'roro', 6),
  ('40 CU YD ENCLOSED', 'roro', 7),
  ('6 CU YD', 'skip', 1),
  ('8 CU YD', 'skip', 2),
  ('10 CU YD', 'skip', 3),
  ('12 CU YD', 'skip', 4),
  ('14 CU YD', 'skip', 5),
  ('16 CU YD', 'skip', 6),
  ('12 CU YD ENCLOSED', 'skip', 7),
  ('SKIP COMPACTOR', 'skip', 8);