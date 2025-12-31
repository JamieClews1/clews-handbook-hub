-- Create partner questionnaires table for onboarding compliance
CREATE TABLE public.partner_questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed', 'approved', 'rejected')),
  
  -- Section 1: Company Details
  company_name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  telephone TEXT,
  email_orders TEXT,
  email_remittances TEXT,
  company_registration_number TEXT,
  waste_carriers_licence_number TEXT,
  vat_number TEXT,
  sic_code TEXT,
  
  -- Section 2: Services Summary
  can_provide_prices_by_postcode BOOLEAN,
  price_validity_dates TEXT,
  services_chain_lifts BOOLEAN DEFAULT false,
  services_enclosed_skips BOOLEAN DEFAULT false,
  services_roll_on_roll_offs BOOLEAN DEFAULT false,
  services_road_sweeper BOOLEAN DEFAULT false,
  services_wheelie_bin BOOLEAN DEFAULT false,
  services_grab_hire BOOLEAN DEFAULT false,
  services_man_in_van BOOLEAN DEFAULT false,
  services_asbestos BOOLEAN DEFAULT false,
  
  -- Section 3: Supplier Compliance (document availability)
  has_waste_carriers_licence BOOLEAN DEFAULT false,
  has_waste_management_licence BOOLEAN DEFAULT false,
  has_employers_liability_insurance BOOLEAN DEFAULT false,
  has_public_liability_insurance BOOLEAN DEFAULT false,
  has_weighbridge_certificate BOOLEAN DEFAULT false,
  has_quarterly_return BOOLEAN DEFAULT false,
  has_epr_car_report BOOLEAN DEFAULT false,
  has_sample_wtn BOOLEAN DEFAULT false,
  transfers_waste_to_other_sites BOOLEAN DEFAULT false,
  waste_transfer_details TEXT,
  
  -- Section 4: SHEQ
  sheq_responsible_name TEXT,
  sheq_responsible_qualification TEXT,
  sheq_responsible_email TEXT,
  has_emas_certification BOOLEAN DEFAULT false,
  has_iso_9001 BOOLEAN DEFAULT false,
  has_iso_14001 BOOLEAN DEFAULT false,
  has_bs_8555 BOOLEAN DEFAULT false,
  
  -- Policies
  has_health_safety_policy BOOLEAN DEFAULT false,
  has_environmental_policy BOOLEAN DEFAULT false,
  has_modern_slavery_policy BOOLEAN DEFAULT false,
  has_quality_policy BOOLEAN DEFAULT false,
  has_anti_bribery_policy BOOLEAN DEFAULT false,
  has_equality_diversity_policy BOOLEAN DEFAULT false,
  has_gdpr_policy BOOLEAN DEFAULT false,
  
  -- Modern Slavery Investigation
  has_slavery_investigation BOOLEAN DEFAULT false,
  slavery_investigation_details TEXT,
  
  -- Health & Safety
  has_h_and_s_proceedings BOOLEAN DEFAULT false,
  h_and_s_proceedings_details TEXT,
  investigates_accidents BOOLEAN DEFAULT false,
  has_riddor_incidents BOOLEAN DEFAULT false,
  riddor_details TEXT,
  provides_ppe BOOLEAN DEFAULT false,
  complies_skip_loader_guidance BOOLEAN DEFAULT false,
  complies_skip_container_safety BOOLEAN DEFAULT false,
  complies_loler BOOLEAN DEFAULT false,
  complies_puwer BOOLEAN DEFAULT false,
  has_fors_clocs BOOLEAN DEFAULT false,
  has_pda_system BOOLEAN DEFAULT false,
  provides_risk_assessments BOOLEAN DEFAULT false,
  operating_systems_used TEXT,
  provides_weekly_invoices_wtns BOOLEAN DEFAULT false,
  weekly_reporting_notes TEXT,
  
  -- Section 5: Invoicing
  invoicing_software TEXT,
  invoice_day TEXT,
  wtn_delivery_method TEXT,
  wtn_delivery_timing TEXT,
  provides_weights_breakdowns BOOLEAN DEFAULT false,
  weights_breakdowns_format TEXT,
  waste_reporting_name TEXT,
  waste_reporting_email TEXT,
  waste_reporting_phone TEXT,
  
  -- Section 6: Responsible Business
  community_responsible_name TEXT,
  community_responsible_email TEXT,
  community_responsible_phone TEXT,
  has_sustainability_policy BOOLEAN DEFAULT false,
  has_social_value_policy BOOLEAN DEFAULT false,
  has_community_programmes BOOLEAN DEFAULT false,
  community_programme_details TEXT,
  has_social_media_policy BOOLEAN DEFAULT false,
  has_whistle_blowing_policy BOOLEAN DEFAULT false,
  has_employee_handbook BOOLEAN DEFAULT false,
  has_minimum_wage_policy BOOLEAN DEFAULT false,
  issues_zero_hour_contracts BOOLEAN DEFAULT false,
  zero_hour_explanation TEXT,
  
  -- Signature
  signatory_name TEXT,
  signatory_position TEXT,
  signatory_signature TEXT,
  signed_at TIMESTAMPTZ,
  
  -- Office Use Only
  reviewed_by TEXT,
  reviewed_signature TEXT,
  reviewed_position TEXT,
  reviewed_at TIMESTAMPTZ,
  partner_ranking TEXT CHECK (partner_ranking IN ('A', 'B', 'C')),
  additional_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.partner_questionnaires ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all questionnaires"
ON public.partner_questionnaires
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view and submit via share token"
ON public.partner_questionnaires
FOR SELECT
USING (share_token IS NOT NULL);

CREATE POLICY "Public can update pending questionnaires via share token"
ON public.partner_questionnaires
FOR UPDATE
USING (share_token IS NOT NULL AND status = 'pending')
WITH CHECK (share_token IS NOT NULL AND status IN ('pending', 'submitted'));

CREATE POLICY "Authenticated users can view questionnaires"
ON public.partner_questionnaires
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_partner_questionnaires_updated_at
BEFORE UPDATE ON public.partner_questionnaires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();