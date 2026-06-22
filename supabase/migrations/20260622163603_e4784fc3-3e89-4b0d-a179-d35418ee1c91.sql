CREATE TABLE public.pricing_rate_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('residential','trade','broker','bespoke')),
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  effective_date DATE,
  agreed_by TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_rate_card_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.pricing_rate_cards(id) ON DELETE CASCADE,
  zone_code TEXT NOT NULL,
  zone_name TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_rate_card_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.pricing_rate_cards(id) ON DELETE CASCADE,
  section TEXT,
  label TEXT NOT NULL,
  note TEXT,
  unit TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_rate_card_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  row_id UUID NOT NULL REFERENCES public.pricing_rate_card_rows(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.pricing_rate_card_zones(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'na' CHECK (status IN ('price','call_for_quote','na','text')),
  price NUMERIC,
  text_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (row_id, zone_id)
);

CREATE TABLE public.pricing_zone_postcodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postcode_prefix TEXT NOT NULL,
  zone_code TEXT NOT NULL,
  area TEXT,
  services TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_zones_card ON public.pricing_rate_card_zones(card_id);
CREATE INDEX idx_pricing_rows_card ON public.pricing_rate_card_rows(card_id);
CREATE INDEX idx_pricing_values_row ON public.pricing_rate_card_values(row_id);
CREATE INDEX idx_pricing_values_zone ON public.pricing_rate_card_values(zone_id);
CREATE INDEX idx_pricing_postcodes_prefix ON public.pricing_zone_postcodes(postcode_prefix);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rate_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rate_card_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rate_card_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rate_card_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_zone_postcodes TO authenticated;
GRANT ALL ON public.pricing_rate_cards TO service_role;
GRANT ALL ON public.pricing_rate_card_zones TO service_role;
GRANT ALL ON public.pricing_rate_card_rows TO service_role;
GRANT ALL ON public.pricing_rate_card_values TO service_role;
GRANT ALL ON public.pricing_zone_postcodes TO service_role;

ALTER TABLE public.pricing_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rate_card_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rate_card_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rate_card_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_zone_postcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage rate cards" ON public.pricing_rate_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can manage rate card zones" ON public.pricing_rate_card_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can manage rate card rows" ON public.pricing_rate_card_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can manage rate card values" ON public.pricing_rate_card_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can manage zone postcodes" ON public.pricing_zone_postcodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_pricing_rate_cards_updated_at BEFORE UPDATE ON public.pricing_rate_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rate_card_zones_updated_at BEFORE UPDATE ON public.pricing_rate_card_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rate_card_rows_updated_at BEFORE UPDATE ON public.pricing_rate_card_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rate_card_values_updated_at BEFORE UPDATE ON public.pricing_rate_card_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_zone_postcodes_updated_at BEFORE UPDATE ON public.pricing_zone_postcodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();