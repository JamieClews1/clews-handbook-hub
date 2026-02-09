-- Add description and waste breakdown fields to staci_pallet_entries
ALTER TABLE public.staci_pallet_entries 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS waste_breakdown JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.staci_pallet_entries.description IS 'Description of pallet contents';
COMMENT ON COLUMN public.staci_pallet_entries.waste_breakdown IS 'JSON object with percentage breakdown by waste type (metal, paper, card, pvc, hard_plastic, shrink_wrap, other_films_plastics, rdf, wood, landfill)';