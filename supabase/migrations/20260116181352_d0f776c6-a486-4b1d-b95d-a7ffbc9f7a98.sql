-- Create table for monthly site inspection reports
CREATE TABLE public.site_inspection_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  site_location TEXT NOT NULL,
  inspector_name TEXT NOT NULL,
  
  -- Housekeeping Section
  housekeeping_general_cleanliness TEXT CHECK (housekeeping_general_cleanliness IN ('good', 'acceptable', 'poor', 'n/a')),
  housekeeping_waste_disposal TEXT CHECK (housekeeping_waste_disposal IN ('good', 'acceptable', 'poor', 'n/a')),
  housekeeping_storage_areas TEXT CHECK (housekeeping_storage_areas IN ('good', 'acceptable', 'poor', 'n/a')),
  housekeeping_walkways_clear TEXT CHECK (housekeeping_walkways_clear IN ('good', 'acceptable', 'poor', 'n/a')),
  housekeeping_comments TEXT,
  
  -- Fire Safety Section
  fire_extinguishers_accessible TEXT CHECK (fire_extinguishers_accessible IN ('good', 'acceptable', 'poor', 'n/a')),
  fire_exits_clear TEXT CHECK (fire_exits_clear IN ('good', 'acceptable', 'poor', 'n/a')),
  fire_signage_visible TEXT CHECK (fire_signage_visible IN ('good', 'acceptable', 'poor', 'n/a')),
  fire_assembly_point_clear TEXT CHECK (fire_assembly_point_clear IN ('good', 'acceptable', 'poor', 'n/a')),
  fire_safety_comments TEXT,
  
  -- First Aid Section
  first_aid_kit_stocked TEXT CHECK (first_aid_kit_stocked IN ('good', 'acceptable', 'poor', 'n/a')),
  first_aid_signage TEXT CHECK (first_aid_signage IN ('good', 'acceptable', 'poor', 'n/a')),
  first_aid_trained_personnel TEXT CHECK (first_aid_trained_personnel IN ('good', 'acceptable', 'poor', 'n/a')),
  first_aid_comments TEXT,
  
  -- PPE Section
  ppe_available TEXT CHECK (ppe_available IN ('good', 'acceptable', 'poor', 'n/a')),
  ppe_condition TEXT CHECK (ppe_condition IN ('good', 'acceptable', 'poor', 'n/a')),
  ppe_being_worn TEXT CHECK (ppe_being_worn IN ('good', 'acceptable', 'poor', 'n/a')),
  ppe_comments TEXT,
  
  -- Equipment Section
  equipment_condition TEXT CHECK (equipment_condition IN ('good', 'acceptable', 'poor', 'n/a')),
  equipment_guarding TEXT CHECK (equipment_guarding IN ('good', 'acceptable', 'poor', 'n/a')),
  equipment_maintenance_records TEXT CHECK (equipment_maintenance_records IN ('good', 'acceptable', 'poor', 'n/a')),
  equipment_comments TEXT,
  
  -- Electrical Safety Section
  electrical_equipment_condition TEXT CHECK (electrical_equipment_condition IN ('good', 'acceptable', 'poor', 'n/a')),
  electrical_cables_secure TEXT CHECK (electrical_cables_secure IN ('good', 'acceptable', 'poor', 'n/a')),
  electrical_pat_testing TEXT CHECK (electrical_pat_testing IN ('good', 'acceptable', 'poor', 'n/a')),
  electrical_comments TEXT,
  
  -- Welfare Facilities Section
  welfare_toilets_clean TEXT CHECK (welfare_toilets_clean IN ('good', 'acceptable', 'poor', 'n/a')),
  welfare_drinking_water TEXT CHECK (welfare_drinking_water IN ('good', 'acceptable', 'poor', 'n/a')),
  welfare_rest_areas TEXT CHECK (welfare_rest_areas IN ('good', 'acceptable', 'poor', 'n/a')),
  welfare_comments TEXT,
  
  -- Environmental Section
  environmental_spill_kits TEXT CHECK (environmental_spill_kits IN ('good', 'acceptable', 'poor', 'n/a')),
  environmental_waste_segregation TEXT CHECK (environmental_waste_segregation IN ('good', 'acceptable', 'poor', 'n/a')),
  environmental_drainage TEXT CHECK (environmental_drainage IN ('good', 'acceptable', 'poor', 'n/a')),
  environmental_comments TEXT,
  
  -- Actions & Sign-off
  actions_required TEXT,
  overall_comments TEXT,
  signature_image TEXT,
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_inspection_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports" 
ON public.site_inspection_reports 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own reports
CREATE POLICY "Users can create own reports" 
ON public.site_inspection_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own reports
CREATE POLICY "Users can update own reports" 
ON public.site_inspection_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" 
ON public.site_inspection_reports 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_site_inspection_reports_updated_at
BEFORE UPDATE ON public.site_inspection_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();