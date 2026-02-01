-- Create near_miss_reports table for public submissions
CREATE TABLE public.near_miss_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Report details
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  potential_consequences TEXT,
  suggested_actions TEXT,
  
  -- Reporter info (optional for anonymous reports)
  reporter_name TEXT,
  reporter_department TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT
);

-- Enable RLS
ALTER TABLE public.near_miss_reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit near miss reports"
ON public.near_miss_reports
FOR INSERT
WITH CHECK (true);

-- Only authenticated users with admin/management can view and manage
CREATE POLICY "Admin/management can view near miss reports"
ON public.near_miss_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can update near miss reports"
ON public.near_miss_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admins can delete near miss reports"
ON public.near_miss_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_near_miss_reports_updated_at
BEFORE UPDATE ON public.near_miss_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();