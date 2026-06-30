CREATE TABLE public.container_loads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text UNIQUE,
  status text NOT NULL DEFAULT 'prepping',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  container_number text,
  seal_number text,
  material text,
  ewc_code text,
  basel_code text,
  bale_count integer NOT NULL DEFAULT 0,
  total_weight_t numeric,
  destination_country text,
  destination_facility text,
  export_date date,
  booking_reference text,
  vessel text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  packing jsonb NOT NULL DEFAULT '[]'::jsonb,
  annex7 jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  operator_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_loads TO authenticated;
GRANT ALL ON public.container_loads TO service_role;

ALTER TABLE public.container_loads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view container loads"
  ON public.container_loads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert container loads"
  ON public.container_loads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update container loads"
  ON public.container_loads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete container loads"
  ON public.container_loads FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.generate_container_load_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.reference IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.container_loads
    WHERE reference LIKE 'CL%';
    NEW.reference := 'CL' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_container_load_reference
  BEFORE INSERT ON public.container_loads
  FOR EACH ROW EXECUTE FUNCTION public.generate_container_load_reference();

CREATE TRIGGER update_container_loads_updated_at
  BEFORE UPDATE ON public.container_loads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();