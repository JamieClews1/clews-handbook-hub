CREATE TABLE public.contamination_charge_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  ewc_code text,
  unit_charge numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contamination_charge_items TO authenticated;
GRANT SELECT ON public.contamination_charge_items TO anon;
GRANT ALL ON public.contamination_charge_items TO service_role;

ALTER TABLE public.contamination_charge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view charge items"
  ON public.contamination_charge_items
  FOR SELECT
  USING (true);

CREATE POLICY "Admin/management manage charge items"
  ON public.contamination_charge_items
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE TRIGGER update_contamination_charge_items_updated_at
  BEFORE UPDATE ON public.contamination_charge_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contamination_queries
  ADD COLUMN reported_items jsonb;