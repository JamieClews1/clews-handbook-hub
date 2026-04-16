-- Add tier column
ALTER TABLE public.pricing_entries 
ADD COLUMN tier text NOT NULL DEFAULT 'residential';

-- Drop old constraint, add new one including tier
ALTER TABLE public.pricing_entries 
DROP CONSTRAINT pricing_entries_skip_size_id_zone_id_waste_type_id_key;

CREATE UNIQUE INDEX pricing_entries_size_zone_waste_tier_idx 
ON public.pricing_entries (skip_size_id, zone_id, waste_type_id, tier);

-- Copy residential entries to both trade tiers
INSERT INTO public.pricing_entries (skip_size_id, zone_id, waste_type_id, status, price_ex_vat, tier)
SELECT skip_size_id, zone_id, waste_type_id, status, price_ex_vat, 'tier1_trade'
FROM public.pricing_entries WHERE tier = 'residential';

INSERT INTO public.pricing_entries (skip_size_id, zone_id, waste_type_id, status, price_ex_vat, tier)
SELECT skip_size_id, zone_id, waste_type_id, status, price_ex_vat, 'tier2_trade'
FROM public.pricing_entries WHERE tier = 'residential';