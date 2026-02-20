
-- Mapping table: links Skiptrak waste descriptions to Midweigh Product codes
-- for records where Midweigh Product is blank
CREATE TABLE public.midweigh_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skiptrak_waste_description TEXT NOT NULL UNIQUE,
  midweigh_product_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.midweigh_product_mappings ENABLE ROW LEVEL SECURITY;

-- Admin/management can manage mappings
CREATE POLICY "Admin/management can manage midweigh product mappings"
  ON public.midweigh_product_mappings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Authenticated users can view mappings
CREATE POLICY "Authenticated users can view midweigh product mappings"
  ON public.midweigh_product_mappings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_midweigh_product_mappings_updated_at
  BEFORE UPDATE ON public.midweigh_product_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
