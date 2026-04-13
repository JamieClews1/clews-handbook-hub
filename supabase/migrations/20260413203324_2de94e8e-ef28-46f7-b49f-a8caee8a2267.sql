
-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  collection_date DATE,
  collection_time_slot TEXT,
  container_type TEXT,
  waste_type TEXT,
  quantity INTEGER DEFAULT 1,
  status public.booking_status NOT NULL DEFAULT 'pending',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  special_instructions TEXT,
  internal_notes TEXT,
  created_by UUID,
  assigned_driver TEXT,
  vehicle_reg TEXT,
  source TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Staff can do everything (users with a role in user_roles)
CREATE POLICY "Staff can view all bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can create bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can delete bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

-- Auto-generate booking reference
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(booking_reference FROM 3) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.bookings
  WHERE booking_reference LIKE 'BK%';
  
  NEW.booking_reference := 'BK' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_booking_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_booking_reference();

-- Updated_at trigger
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_collection_date ON public.bookings(collection_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
