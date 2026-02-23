
-- Credit account applications table
CREATE TABLE public.credit_account_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Status: pending (sent to customer), submitted (customer filled in), approved, rejected
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Applicant details
  business_name TEXT,
  holding_company TEXT,
  registered_office TEXT,
  registered_office_postcode TEXT,
  invoice_address TEXT,
  invoice_address_postcode TEXT,
  date_of_incorporation TEXT,
  nature_of_business TEXT,
  company_telephone TEXT,
  mobile_number TEXT,
  vat_number TEXT,
  eori_number TEXT,
  contact_name TEXT,
  contact_position TEXT,
  invoice_email TEXT,
  
  -- Trade references (stored as JSONB array)
  trade_references JSONB DEFAULT '[]'::jsonb,
  
  -- Credit requested
  credit_requested NUMERIC,
  
  -- Applicant signature
  applicant_signature TEXT,
  applicant_print_name TEXT,
  applicant_signed_date DATE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Approval (office use)
  approved BOOLEAN,
  approved_by_name TEXT,
  approved_by_signature TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Link to customer (optional, set after approval)
  customer_id UUID REFERENCES public.customers(id),
  
  -- Account details set after approval
  account_number TEXT,
  credit_limit_set NUMERIC
);

-- Enable RLS
ALTER TABLE public.credit_account_applications ENABLE ROW LEVEL SECURITY;

-- Admins/management can do everything
CREATE POLICY "Admin/management can manage credit applications"
ON public.credit_account_applications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Public can view pending applications via share token
CREATE POLICY "Public can view via share token"
ON public.credit_account_applications
FOR SELECT
USING (share_token IS NOT NULL);

-- Public can update pending applications via share token
CREATE POLICY "Public can submit via share token"
ON public.credit_account_applications
FOR UPDATE
USING (share_token IS NOT NULL AND status = 'pending')
WITH CHECK (share_token IS NOT NULL AND status IN ('pending', 'submitted'));

-- Timestamp trigger
CREATE TRIGGER update_credit_account_applications_updated_at
BEFORE UPDATE ON public.credit_account_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
