-- Add driver completion fields to route_one_jobs
ALTER TABLE public.route_one_jobs 
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_notes TEXT,
  ADD COLUMN IF NOT EXISTS contamination_type TEXT,
  ADD COLUMN IF NOT EXISTS contamination_notes TEXT;

-- Create job photos table
CREATE TABLE IF NOT EXISTS public.route_one_job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.route_one_jobs(id) ON DELETE CASCADE NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'general',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.route_one_job_photos ENABLE ROW LEVEL SECURITY;

-- Public read/write for job photos (drivers use PIN auth not supabase auth)
CREATE POLICY "Allow all access to job photos" ON public.route_one_job_photos
  FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('route-one-photos', 'route-one-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for route-one-photos bucket
CREATE POLICY "Allow public read route-one-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'route-one-photos');

CREATE POLICY "Allow public upload route-one-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'route-one-photos');

CREATE POLICY "Allow public delete route-one-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'route-one-photos');