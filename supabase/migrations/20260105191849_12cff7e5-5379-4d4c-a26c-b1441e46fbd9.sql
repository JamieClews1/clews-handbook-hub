-- Create company_profile table for storing company information
CREATE TABLE public.company_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Company Key Info
  company_name text NOT NULL DEFAULT 'Clews Recycling Limited',
  trading_name text,
  registered_address text,
  operational_address text,
  telephone text,
  email text,
  website text,
  company_registration_number text,
  date_of_incorporation date,
  vat_number text,
  sic_code text,
  
  -- Financial Information
  bank_name text,
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  bank_iban text,
  bank_swift_bic text,
  credit_terms text,
  
  -- Duty of Care
  waste_carriers_licence_number text,
  waste_carriers_licence_expiry date,
  environment_agency_reference text,
  iso_14001_certified boolean DEFAULT false,
  iso_9001_certified boolean DEFAULT false,
  health_safety_policy boolean DEFAULT true,
  environmental_policy boolean DEFAULT true,
  public_liability_insurance_provider text,
  public_liability_insurance_expiry date,
  employers_liability_insurance_provider text,
  employers_liability_insurance_expiry date
);

-- Enable RLS
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view company profile"
  ON public.company_profile
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert company profile"
  ON public.company_profile
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update company profile"
  ON public.company_profile
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete company profile"
  ON public.company_profile
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_company_profile_updated_at
  BEFORE UPDATE ON public.company_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company profile
INSERT INTO public.company_profile (
  company_name,
  trading_name,
  health_safety_policy,
  environmental_policy
) VALUES (
  'Clews Recycling Limited',
  'Clews Recycling',
  true,
  true
);