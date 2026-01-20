-- Create load_reports table for tracking pallet loads
CREATE TABLE public.load_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operator_id UUID REFERENCES public.profiles(id),
  operator_name TEXT NOT NULL,
  vehicle_reg TEXT,
  notes TEXT,
  total_pallets INTEGER NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create load_line_items table for individual waste type entries
CREATE TABLE public.load_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_report_id UUID NOT NULL REFERENCES public.load_reports(id) ON DELETE CASCADE,
  waste_type TEXT NOT NULL,
  pallet_count INTEGER NOT NULL DEFAULT 0,
  avg_weight_kg NUMERIC NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create load_waste_types table for configurable waste types with default weights
CREATE TABLE public.load_waste_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type TEXT NOT NULL,
  default_avg_weight_kg NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default waste types with weights
INSERT INTO public.load_waste_types (waste_type, default_avg_weight_kg, display_order) VALUES
  ('Card Bales', 450, 1),
  ('Card Loose', 250, 2),
  ('Paper', 400, 3),
  ('Paper Tubes', 200, 4),
  ('Waste', 300, 5),
  ('Wood', 500, 6);

-- Enable RLS on all tables
ALTER TABLE public.load_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_waste_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for load_reports
CREATE POLICY "Authenticated users can view load reports"
  ON public.load_reports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create load reports"
  ON public.load_reports
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own draft reports"
  ON public.load_reports
  FOR UPDATE
  USING (auth.uid() = operator_id AND status = 'draft');

CREATE POLICY "Admins can update any load report"
  ON public.load_reports
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete load reports"
  ON public.load_reports
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for load_line_items
CREATE POLICY "Authenticated users can view load line items"
  ON public.load_line_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage line items for their reports"
  ON public.load_line_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.load_reports r
    WHERE r.id = load_line_items.load_report_id
    AND (r.operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- RLS policies for load_waste_types
CREATE POLICY "Anyone can view active waste types"
  ON public.load_waste_types
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage waste types"
  ON public.load_waste_types
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for load photos
INSERT INTO storage.buckets (id, name, public) VALUES ('load-photos', 'load-photos', true);

-- Storage policies for load photos
CREATE POLICY "Authenticated users can upload load photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'load-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view load photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'load-photos');

CREATE POLICY "Users can delete their own load photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'load-photos' AND auth.uid() IS NOT NULL);

-- Add updated_at triggers
CREATE TRIGGER update_load_reports_updated_at
  BEFORE UPDATE ON public.load_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_load_line_items_updated_at
  BEFORE UPDATE ON public.load_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();