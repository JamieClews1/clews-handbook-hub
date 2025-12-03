-- Add is_published column to toolbox_talks table
ALTER TABLE public.toolbox_talks 
ADD COLUMN is_published boolean NOT NULL DEFAULT false;

-- Update existing records to be published by default
UPDATE public.toolbox_talks SET is_published = true;