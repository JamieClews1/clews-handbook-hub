-- Add pallet_count column to staci_pallet_entries
ALTER TABLE public.staci_pallet_entries 
ADD COLUMN IF NOT EXISTS pallet_count INTEGER NOT NULL DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.staci_pallet_entries.pallet_count IS 'Number of pallets of this type';