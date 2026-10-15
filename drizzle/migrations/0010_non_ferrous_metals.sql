CREATE TABLE public.nf_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  storage_location text,
  price_per_tonne numeric NOT NULL DEFAULT 0,
  stock_limit_kg numeric,
  warn_at_kg numeric,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES public.nf_grades(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.nf_buyers(id) ON DELETE SET NULL,
  price_per_tonne numeric NOT NULL,
  effective_date date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  notes text,
  photo_path text,
  staff_name text NOT NULL,
  yard_staff_id uuid,
  user_id uuid,
  client_ref text UNIQUE,
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_sort_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  grade_id uuid NOT NULL REFERENCES public.nf_grades(id),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  session_ref text,
  notes text,
  staff_name text NOT NULL,
  yard_staff_id uuid,
  user_id uuid,
  client_ref text UNIQUE,
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_date date NOT NULL DEFAULT current_date,
  buyer_id uuid REFERENCES public.nf_buyers(id),
  grade_id uuid NOT NULL REFERENCES public.nf_grades(id),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  price_per_tonne numeric NOT NULL DEFAULT 0,
  total_value numeric GENERATED ALWAYS AS (round(weight_kg / 1000 * price_per_tonne, 2)) STORED,
  sales_ref text,
  weighbridge_ticket text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES public.nf_grades(id),
  adjustment_kg numeric NOT NULL,
  reason text NOT NULL,
  authorised_by uuid,
  authorised_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nf_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  amended_by_name text,
  amended_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['nf_grades','nf_buyers','nf_prices','nf_collections','nf_sort_entries','nf_dispatches','nf_adjustments','nf_amendments'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "Staff manage %s" ON public.%I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t, t);
END LOOP; END $$;
INSERT INTO public.nf_grades (name, storage_location, price_per_tonne, stock_limit_kg, warn_at_kg, display_order) VALUES
('Copper','Secure storage – packing shed',8000,NULL,NULL,1),
('Brass','Aggregate bags',0,NULL,NULL,2),
('Cable','Aggregate bags',0,NULL,NULL,3),
('Lead','Aggregate bags (≤50 kg) / Dolav box (>50 kg)',0,500,400,4),
('Electric motors','Cut-off IBC / Dolav box',0,NULL,NULL,5),
('Starters & alternators','Cut-off IBC / Dolav box',0,NULL,NULL,6),
('Lead-acid batteries','Battery box (lidded box if outside)',0,500,400,7),
('Aluminium','Dedicated skip outside packing shed',1100,NULL,NULL,8),
('Aluminium wheels','Cut-off IBC',0,NULL,NULL,9),
('Stainless steel','Dolav box',0,NULL,NULL,10),
('Other non-ferrous','Old garage designated area',0,NULL,NULL,11);