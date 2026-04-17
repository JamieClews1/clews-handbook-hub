CREATE TABLE public.enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new',
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiries_customer_id ON public.enquiries(customer_id);
CREATE INDEX idx_enquiries_status ON public.enquiries(status);
CREATE INDEX idx_enquiries_created_at ON public.enquiries(created_at DESC);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/management can manage enquiries"
ON public.enquiries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Authenticated users can create enquiries"
ON public.enquiries
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE TRIGGER update_enquiries_updated_at
BEFORE UPDATE ON public.enquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();