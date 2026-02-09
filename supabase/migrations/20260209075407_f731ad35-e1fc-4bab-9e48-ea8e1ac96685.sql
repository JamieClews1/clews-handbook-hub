-- Create table for Staci pallet entries (pallet-by-pallet with colour classification)
CREATE TABLE public.staci_pallet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_report_id UUID NOT NULL REFERENCES public.load_reports(id) ON DELETE CASCADE,
  colour TEXT NOT NULL CHECK (colour IN ('red', 'yellow', 'blue', 'green', 'waste_wood')),
  weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pallet_type TEXT DEFAULT 'good' CHECK (pallet_type IN ('good', 'scrap')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.staci_pallet_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same as load_line_items - authenticated users can manage)
CREATE POLICY "Authenticated users can view staci pallet entries"
  ON public.staci_pallet_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create staci pallet entries"
  ON public.staci_pallet_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update staci pallet entries"
  ON public.staci_pallet_entries
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete staci pallet entries"
  ON public.staci_pallet_entries
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_staci_pallet_entries_updated_at
  BEFORE UPDATE ON public.staci_pallet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_staci_pallet_entries_load_report_id ON public.staci_pallet_entries(load_report_id);
CREATE INDEX idx_staci_pallet_entries_colour ON public.staci_pallet_entries(colour);