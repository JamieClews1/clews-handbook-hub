-- 1. Rental chases (mini CMS for over-rental bins)
CREATE TABLE public.rental_chases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bin_key TEXT NOT NULL UNIQUE,
  customer TEXT,
  site TEXT,
  category TEXT,
  container_type TEXT,
  chase_status TEXT NOT NULL DEFAULT 'not_chased',
  agreed_to_pay BOOLEAN NOT NULL DEFAULT false,
  agreed_amount NUMERIC,
  agreed_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_chases TO authenticated;
GRANT ALL ON public.rental_chases TO service_role;
ALTER TABLE public.rental_chases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view rental chases" ON public.rental_chases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert rental chases" ON public.rental_chases
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update rental chases" ON public.rental_chases
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete rental chases" ON public.rental_chases
  FOR DELETE TO authenticated USING (true);

-- 2. Rental chase email history
CREATE TABLE public.rental_chase_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chase_id UUID NOT NULL REFERENCES public.rental_chases(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_chase_emails TO authenticated;
GRANT ALL ON public.rental_chase_emails TO service_role;
ALTER TABLE public.rental_chase_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view rental chase emails" ON public.rental_chase_emails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert rental chase emails" ON public.rental_chase_emails
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Confirmed rental agreements
CREATE TABLE public.rental_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer TEXT,
  site TEXT,
  container_type TEXT,
  agreed_rate NUMERIC,
  rate_period TEXT NOT NULL DEFAULT 'week',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  chase_id UUID REFERENCES public.rental_chases(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_agreements TO authenticated;
GRANT ALL ON public.rental_agreements TO service_role;
ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view rental agreements" ON public.rental_agreements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert rental agreements" ON public.rental_agreements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update rental agreements" ON public.rental_agreements
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete rental agreements" ON public.rental_agreements
  FOR DELETE TO authenticated USING (true);

-- updated_at triggers
CREATE TRIGGER update_rental_chases_updated_at
  BEFORE UPDATE ON public.rental_chases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rental_agreements_updated_at
  BEFORE UPDATE ON public.rental_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();