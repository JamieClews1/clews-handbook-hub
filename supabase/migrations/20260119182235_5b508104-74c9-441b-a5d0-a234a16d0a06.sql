-- Add todo_items column to store action items as JSON
ALTER TABLE public.site_inspection_reports 
ADD COLUMN IF NOT EXISTS todo_items jsonb DEFAULT '[]'::jsonb;