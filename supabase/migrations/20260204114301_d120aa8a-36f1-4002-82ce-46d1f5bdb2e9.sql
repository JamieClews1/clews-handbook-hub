-- Create rebate rules table for universal configurable rules
CREATE TABLE public.rebate_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_key TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  rule_value DECIMAL(10,2) DEFAULT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rebate_rules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view rules
CREATE POLICY "Authenticated users can view rebate rules"
  ON public.rebate_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only management users can modify rules
CREATE POLICY "Management can manage rebate rules"
  ON public.rebate_rules FOR ALL
  USING (public.is_management(auth.uid()));

-- Insert the first rule: minimum weight threshold
INSERT INTO public.rebate_rules (rule_key, rule_name, description, is_enabled, rule_value, display_order)
VALUES (
  'min_weight_threshold',
  'Minimum Weight Threshold',
  'No rebate is due if the final card weight (weighbridge weight minus pallet weight) is less than the specified threshold.',
  true,
  1.5,
  10
);

-- Create trigger for updated_at
CREATE TRIGGER update_rebate_rules_updated_at
  BEFORE UPDATE ON public.rebate_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();