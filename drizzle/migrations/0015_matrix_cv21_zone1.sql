INSERT INTO public.pricing_zone_postcodes (postcode_prefix, zone_code, area)
SELECT 'CV21', 'Zone 1', 'All CV21 (confirmed Zone 1)'
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_zone_postcodes WHERE postcode_prefix = 'CV21');