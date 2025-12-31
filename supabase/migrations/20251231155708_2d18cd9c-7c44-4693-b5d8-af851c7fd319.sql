-- Create table for facility recycling forms
CREATE TABLE public.facility_recycling_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Facility info
  form_date DATE NOT NULL DEFAULT CURRENT_DATE,
  facility_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  wml_license_number TEXT,
  completed_by TEXT NOT NULL,
  
  -- Rates
  average_recycling_rate DECIMAL(5,2),
  average_recovery_rate DECIMAL(5,2),
  
  -- Additional questions
  can_skips_be_weighed TEXT CHECK (can_skips_be_weighed IN ('yes', 'no', 'na')),
  skips_weighed_notes TEXT,
  can_waste_breakdown_per_skip TEXT CHECK (can_waste_breakdown_per_skip IN ('yes', 'no', 'na')),
  waste_breakdown_notes TEXT,
  
  -- Office use
  desktop_audit BOOLEAN,
  visual_audit BOOLEAN,
  desktop_audit_completed_by TEXT,
  desktop_audit_checked_by TEXT,
  additional_comments TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
  
  -- Share token for public access
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Creator
  created_by UUID REFERENCES auth.users(id)
);

-- Create table for waste type entries
CREATE TABLE public.facility_recycling_waste_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.facility_recycling_forms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  waste_type TEXT NOT NULL,
  ewc_code TEXT,
  percent_recycled DECIMAL(5,2) DEFAULT 0,
  percent_recovered DECIMAL(5,2) DEFAULT 0,
  percent_landfill DECIMAL(5,2) DEFAULT 0,
  final_destination_info TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.facility_recycling_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_recycling_waste_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for facility_recycling_forms
CREATE POLICY "Admins can manage all forms" 
ON public.facility_recycling_forms 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own forms" 
ON public.facility_recycling_forms 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create forms" 
ON public.facility_recycling_forms 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Public can view shared forms" 
ON public.facility_recycling_forms 
FOR SELECT 
USING (share_token IS NOT NULL AND status != 'draft');

-- RLS Policies for waste entries
CREATE POLICY "Admins can manage all waste entries" 
ON public.facility_recycling_waste_entries 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage waste entries for their forms" 
ON public.facility_recycling_waste_entries 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.facility_recycling_forms f 
    WHERE f.id = form_id AND f.created_by = auth.uid()
  )
);

CREATE POLICY "Public can view waste entries for shared forms" 
ON public.facility_recycling_waste_entries 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.facility_recycling_forms f 
    WHERE f.id = form_id AND f.share_token IS NOT NULL AND f.status != 'draft'
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_facility_recycling_forms_updated_at
BEFORE UPDATE ON public.facility_recycling_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facility_recycling_waste_entries_updated_at
BEFORE UPDATE ON public.facility_recycling_waste_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default waste types template
CREATE TABLE public.default_waste_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type TEXT NOT NULL,
  ewc_code TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.default_waste_types (waste_type, ewc_code, display_order) VALUES
('Aggregates', NULL, 1),
('Hardcore/Concrete', NULL, 2),
('Ceramics', NULL, 3),
('Ceiling Tiles', NULL, 4),
('Soil', NULL, 5),
('Cardboard', NULL, 6),
('Paper', NULL, 7),
('Soft Plastic', NULL, 8),
('Hard Plastic', NULL, 9),
('Plate Glass', NULL, 10),
('Glass Bottles', NULL, 11),
('Timber', NULL, 12),
('MDF', NULL, 13),
('Ply & Chipboard', NULL, 14),
('Metal', NULL, 15),
('Plasterboard', NULL, 16),
('Insulation Materials', NULL, 17),
('Fabrics', NULL, 18),
('Canteen Waste', NULL, 19),
('Vegetation/Green Waste', '20.02.01', 20),
('Dry Mixed Recycling', NULL, 21),
('Construction Waste containing WEEE', '17.09.04', 22),
('Wood', '17.02.01', 23),
('Hardcore (Bricks/Rubble/Concrete)', '17.01.07', 24),
('Shot Blast', '12.01.17', 25);

ALTER TABLE public.default_waste_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view default waste types" 
ON public.default_waste_types 
FOR SELECT 
USING (true);