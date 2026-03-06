
-- Weighbridge waste types with price per tonne
CREATE TABLE public.weighbridge_waste_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type TEXT NOT NULL,
  ewc_code TEXT,
  price_per_tonne NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weighbridge_waste_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weighbridge waste types"
  ON public.weighbridge_waste_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage weighbridge waste types"
  ON public.weighbridge_waste_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_weighbridge_waste_types_updated_at
  BEFORE UPDATE ON public.weighbridge_waste_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add price_per_tonne and total_price to weighbridge_transactions
ALTER TABLE public.weighbridge_transactions
  ADD COLUMN waste_type_id UUID REFERENCES public.weighbridge_waste_types(id),
  ADD COLUMN price_per_tonne NUMERIC(10,2),
  ADD COLUMN weight_charge NUMERIC(10,2),
  ADD COLUMN additional_items_total NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN total_price NUMERIC(10,2);

-- Additional line items on a transaction (e.g. surcharges, extra services)
CREATE TABLE public.weighbridge_additional_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.weighbridge_transactions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weighbridge_additional_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weighbridge additional items"
  ON public.weighbridge_additional_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage weighbridge additional items"
  ON public.weighbridge_additional_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_weighbridge_additional_items_tx ON public.weighbridge_additional_items(transaction_id);
