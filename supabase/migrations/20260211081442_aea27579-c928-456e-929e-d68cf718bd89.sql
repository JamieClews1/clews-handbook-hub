
-- Table to store signed STACI monthly reports
CREATE TABLE public.staci_monthly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_by UUID REFERENCES auth.users(id),
  signer_name TEXT,
  signer_position TEXT,
  signature_image TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staci_monthly_reports ENABLE ROW LEVEL SECURITY;

-- Admin/management can manage reports
CREATE POLICY "Admin/management can manage staci monthly reports"
ON public.staci_monthly_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Portal users can view reports for their customer
CREATE POLICY "Portal users can view their staci monthly reports"
ON public.staci_monthly_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_memberships m
    WHERE m.customer_id = staci_monthly_reports.customer_id
    AND m.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_staci_monthly_reports_updated_at
BEFORE UPDATE ON public.staci_monthly_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
