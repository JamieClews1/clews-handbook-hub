-- Create company_contacts table for multiple contact entries
CREATE TABLE public.company_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  full_name TEXT NOT NULL,
  contact_type TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view company contacts"
  ON public.company_contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert company contacts"
  ON public.company_contacts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update company contacts"
  ON public.company_contacts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete company contacts"
  ON public.company_contacts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create riddor_incidents table for H&S tracking
CREATE TABLE public.riddor_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  incident_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  reported_by TEXT,
  status TEXT DEFAULT 'recorded'
);

-- Enable RLS
ALTER TABLE public.riddor_incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view riddor incidents"
  ON public.riddor_incidents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert riddor incidents"
  ON public.riddor_incidents FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update riddor incidents"
  ON public.riddor_incidents FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete riddor incidents"
  ON public.riddor_incidents FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));