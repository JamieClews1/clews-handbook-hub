CREATE TABLE public.skip_inventory_condition_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL,
  condition text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_type, condition)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_inventory_condition_values TO authenticated;
GRANT ALL ON public.skip_inventory_condition_values TO service_role;

ALTER TABLE public.skip_inventory_condition_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view condition values"
  ON public.skip_inventory_condition_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage condition values"
  ON public.skip_inventory_condition_values FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_skip_inventory_condition_values_updated_at
  BEFORE UPDATE ON public.skip_inventory_condition_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  label text,
  is_active boolean NOT NULL DEFAULT true,
  show_values boolean NOT NULL DEFAULT false,
  show_photos boolean NOT NULL DEFAULT true,
  created_by uuid,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_share_links TO authenticated;
GRANT ALL ON public.inventory_share_links TO service_role;

ALTER TABLE public.inventory_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view share links"
  ON public.inventory_share_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage share links"
  ON public.inventory_share_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_inventory_share_links_updated_at
  BEFORE UPDATE ON public.inventory_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.skip_inventory_condition_values (asset_type, condition, value)
SELECT t, c, 0 FROM unnest(ARRAY['skip','roro']) t
CROSS JOIN unnest(ARRAY['Good','Fair','Poor','Damaged','Scrapped','Yard Use']) c;