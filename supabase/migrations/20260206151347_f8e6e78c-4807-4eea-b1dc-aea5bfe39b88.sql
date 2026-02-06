-- Add customer-level skip rebates table for Midweigh data where site is always blank
CREATE TABLE public.customer_skip_rebates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  material_type VARCHAR(50) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'lower',
  value_type_item_id UUID REFERENCES public.rebate_items(id),
  set_value NUMERIC(10,2),
  adjustment NUMERIC(10,2) DEFAULT 0,
  threshold_tonnes NUMERIC(10,2) DEFAULT 0,
  rebate_enabled BOOLEAN DEFAULT true,
  container_type_filter TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_skip_rebates ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Authenticated users can view customer skip rebates"
ON public.customer_skip_rebates
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert customer skip rebates"
ON public.customer_skip_rebates
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update customer skip rebates"
ON public.customer_skip_rebates
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete customer skip rebates"
ON public.customer_skip_rebates
FOR DELETE
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_customer_skip_rebates_updated_at
BEFORE UPDATE ON public.customer_skip_rebates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment to explain the purpose
COMMENT ON TABLE public.customer_skip_rebates IS 'Customer-level rebate configuration for Midweigh data where the site field is always blank';