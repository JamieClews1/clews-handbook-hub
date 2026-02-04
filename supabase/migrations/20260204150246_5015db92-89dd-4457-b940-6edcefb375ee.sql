-- Create enum for skip/roro material types
CREATE TYPE public.skip_material_type AS ENUM ('card_loose', 'scrap_metal');

-- Create table for skip/roro rebate configurations per site
CREATE TABLE public.customer_site_skip_rebates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  material_type public.skip_material_type NOT NULL,
  value_type_item_id UUID REFERENCES public.rebate_items(id) ON DELETE SET NULL,
  value_type TEXT NOT NULL DEFAULT 'lower' CHECK (value_type IN ('lower', 'higher', 'set')),
  set_value NUMERIC DEFAULT NULL,
  adjustment NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, material_type)
);

-- Enable RLS
ALTER TABLE public.customer_site_skip_rebates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage skip rebates (admin-only in practice via app logic)
CREATE POLICY "Authenticated users can manage skip rebates"
ON public.customer_site_skip_rebates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_customer_site_skip_rebates_updated_at
BEFORE UPDATE ON public.customer_site_skip_rebates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();