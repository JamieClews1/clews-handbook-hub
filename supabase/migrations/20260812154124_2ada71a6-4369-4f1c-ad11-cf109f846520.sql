ALTER TABLE public.skip_inventory ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.skip_inventory_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  colour text NOT NULL DEFAULT 'amber',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_inventory_tags TO authenticated;
GRANT ALL ON public.skip_inventory_tags TO service_role;

ALTER TABLE public.skip_inventory_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inventory tags"
ON public.skip_inventory_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage inventory tags"
ON public.skip_inventory_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_skip_inventory_tags_updated_at
BEFORE UPDATE ON public.skip_inventory_tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.skip_inventory_tags (name, colour, display_order)
VALUES ('More photos needed', 'amber', 1)
ON CONFLICT (name) DO NOTHING;