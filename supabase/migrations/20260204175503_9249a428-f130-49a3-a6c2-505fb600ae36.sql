-- Create table to map Data Hub waste descriptions to rebate items
CREATE TABLE public.data_hub_rebate_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_description TEXT NOT NULL UNIQUE,
  rebate_item_id UUID REFERENCES public.rebate_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_hub_rebate_mappings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read mappings
CREATE POLICY "Authenticated users can view rebate mappings"
ON public.data_hub_rebate_mappings
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only admins/management can modify mappings (using has_role for admin and is_management for management)
CREATE POLICY "Admins and management can manage rebate mappings"
ON public.data_hub_rebate_mappings
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_data_hub_rebate_mappings_updated_at
BEFORE UPDATE ON public.data_hub_rebate_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();