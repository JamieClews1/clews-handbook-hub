
-- Table to store unique reporting periods per customer
CREATE TABLE public.customer_reporting_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,       -- e.g. "2025-01"
  month_name TEXT NOT NULL,         -- e.g. "April"
  period_end_date DATE NOT NULL,    -- e.g. "2025-04-25"
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add a flag on the customers table to enable/disable custom reporting periods
ALTER TABLE public.customers ADD COLUMN custom_reporting_periods_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.customer_reporting_periods ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage reporting periods"
  ON public.customer_reporting_periods
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Portal users can read their own customer's periods
CREATE POLICY "Portal users can read their customer reporting periods"
  ON public.customer_reporting_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_portal_memberships
      WHERE user_id = auth.uid() AND customer_id = customer_reporting_periods.customer_id
    )
  );

-- Unique constraint on customer + period label
ALTER TABLE public.customer_reporting_periods
  ADD CONSTRAINT customer_reporting_periods_unique UNIQUE (customer_id, period_label);

-- Index for fast lookups
CREATE INDEX idx_customer_reporting_periods_customer ON public.customer_reporting_periods(customer_id);

-- Trigger for updated_at
CREATE TRIGGER update_customer_reporting_periods_updated_at
  BEFORE UPDATE ON public.customer_reporting_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
