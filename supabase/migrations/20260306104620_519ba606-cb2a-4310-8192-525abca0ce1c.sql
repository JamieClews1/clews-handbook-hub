
-- Weighbridge transaction status enum
CREATE TYPE public.weighbridge_status AS ENUM ('first_weigh', 'completed', 'voided');

-- Main weighbridge transactions table
CREATE TABLE public.weighbridge_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  customer TEXT,
  site TEXT,
  waste_description TEXT,
  ewc_code TEXT,
  container_type TEXT,
  gross_weight_kg NUMERIC(10,2),
  tare_weight_kg NUMERIC(10,2),
  net_weight_kg NUMERIC(10,2),
  status weighbridge_status NOT NULL DEFAULT 'first_weigh',
  first_weigh_at TIMESTAMPTZ DEFAULT now(),
  second_weigh_at TIMESTAMPTZ,
  operator_id UUID REFERENCES public.profiles(id),
  operator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_weighbridge_ticket ON public.weighbridge_transactions(ticket_number);
CREATE INDEX idx_weighbridge_vehicle ON public.weighbridge_transactions(vehicle_reg);
CREATE INDEX idx_weighbridge_status ON public.weighbridge_transactions(status);
CREATE INDEX idx_weighbridge_first_weigh ON public.weighbridge_transactions(first_weigh_at);

-- Enable RLS
ALTER TABLE public.weighbridge_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can CRUD
CREATE POLICY "Authenticated users can view weighbridge transactions"
  ON public.weighbridge_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create weighbridge transactions"
  ON public.weighbridge_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update weighbridge transactions"
  ON public.weighbridge_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete weighbridge transactions"
  ON public.weighbridge_transactions FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE TRIGGER update_weighbridge_transactions_updated_at
  BEFORE UPDATE ON public.weighbridge_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  ticket TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 3) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.weighbridge_transactions
  WHERE ticket_number LIKE 'WB%';
  
  ticket := 'WB' || LPAD(next_num::TEXT, 6, '0');
  RETURN ticket;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.weighbridge_transactions;
