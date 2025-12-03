-- Add reference_code column to toolbox_talks
ALTER TABLE public.toolbox_talks 
ADD COLUMN reference_code text;

-- Update existing records with sequential codes
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as num
  FROM public.toolbox_talks
)
UPDATE public.toolbox_talks 
SET reference_code = 'TBT-' || numbered.num
FROM numbered
WHERE public.toolbox_talks.id = numbered.id;

-- Make it NOT NULL after populating existing data
ALTER TABLE public.toolbox_talks 
ALTER COLUMN reference_code SET NOT NULL;

-- Add unique constraint
ALTER TABLE public.toolbox_talks 
ADD CONSTRAINT toolbox_talks_reference_code_key UNIQUE (reference_code);