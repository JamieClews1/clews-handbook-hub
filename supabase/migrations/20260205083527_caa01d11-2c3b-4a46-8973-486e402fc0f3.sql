-- Create table to log rebate emails sent to customers
CREATE TABLE IF NOT EXISTS public.rebate_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rebate_amount NUMERIC NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rebate_email_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage rebate email logs" ON public.rebate_email_logs;
DROP POLICY IF EXISTS "Management can view rebate email logs" ON public.rebate_email_logs;
DROP POLICY IF EXISTS "Management can insert rebate email logs" ON public.rebate_email_logs;

-- Admin can do everything (using has_role function)
CREATE POLICY "Admins can manage rebate email logs"
  ON public.rebate_email_logs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Management can view (using is_management function)
CREATE POLICY "Management can view rebate email logs"
  ON public.rebate_email_logs
  FOR SELECT
  USING (public.is_management(auth.uid()));

-- Management can insert
CREATE POLICY "Management can insert rebate email logs"
  ON public.rebate_email_logs
  FOR INSERT
  WITH CHECK (public.is_management(auth.uid()));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rebate_email_logs_customer_period ON public.rebate_email_logs(customer_id, period_start, period_end);