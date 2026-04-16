
-- Skip/container sizes
CREATE TABLE public.pricing_skip_sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  size_code TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_skip_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pricing skip sizes"
  ON public.pricing_skip_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can insert pricing skip sizes"
  ON public.pricing_skip_sizes FOR INSERT TO authenticated WITH CHECK (public.is_management(auth.uid()));
CREATE POLICY "Management can update pricing skip sizes"
  ON public.pricing_skip_sizes FOR UPDATE TO authenticated USING (public.is_management(auth.uid()));
CREATE POLICY "Management can delete pricing skip sizes"
  ON public.pricing_skip_sizes FOR DELETE TO authenticated USING (public.is_management(auth.uid()));

-- Waste types for pricing
CREATE TABLE public.pricing_waste_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type_name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_waste_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pricing waste types"
  ON public.pricing_waste_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can insert pricing waste types"
  ON public.pricing_waste_types FOR INSERT TO authenticated WITH CHECK (public.is_management(auth.uid()));
CREATE POLICY "Management can update pricing waste types"
  ON public.pricing_waste_types FOR UPDATE TO authenticated USING (public.is_management(auth.uid()));
CREATE POLICY "Management can delete pricing waste types"
  ON public.pricing_waste_types FOR DELETE TO authenticated USING (public.is_management(auth.uid()));

-- Price matrix entries
CREATE TYPE public.pricing_status AS ENUM ('price', 'call_for_quote', 'not_available');

CREATE TABLE public.pricing_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skip_size_id UUID NOT NULL REFERENCES public.pricing_skip_sizes(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.postcode_zones(id) ON DELETE CASCADE,
  waste_type_id UUID NOT NULL REFERENCES public.pricing_waste_types(id) ON DELETE CASCADE,
  status public.pricing_status NOT NULL DEFAULT 'not_available',
  price_ex_vat NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(skip_size_id, zone_id, waste_type_id)
);

ALTER TABLE public.pricing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pricing entries"
  ON public.pricing_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can insert pricing entries"
  ON public.pricing_entries FOR INSERT TO authenticated WITH CHECK (public.is_management(auth.uid()));
CREATE POLICY "Management can update pricing entries"
  ON public.pricing_entries FOR UPDATE TO authenticated USING (public.is_management(auth.uid()));
CREATE POLICY "Management can delete pricing entries"
  ON public.pricing_entries FOR DELETE TO authenticated USING (public.is_management(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_pricing_skip_sizes_updated_at BEFORE UPDATE ON public.pricing_skip_sizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_waste_types_updated_at BEFORE UPDATE ON public.pricing_waste_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_entries_updated_at BEFORE UPDATE ON public.pricing_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
