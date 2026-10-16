ALTER TABLE public.pricing_rate_card_values ADD COLUMN IF NOT EXISTS included_tonnes numeric;
COMMENT ON COLUMN public.pricing_rate_card_values.included_tonnes IS 'Tonnes included in this price (RoRo work); tonnage above is charged at the per-tonne material rate.';

UPDATE public.pricing_rate_card_values v
SET included_tonnes = CASE WHEN z.zone_code = 'Z1' THEN 1 WHEN z.zone_code = 'Z2' THEN 2 ELSE 3 END
FROM public.pricing_rate_card_rows r, public.pricing_rate_card_zones z
WHERE v.row_id = r.id AND v.zone_id = z.id AND v.included_tonnes IS NULL
  AND r.label ~* 'inc\s*2\s*/\s*inc\s*3';

UPDATE public.pricing_rate_card_values v
SET included_tonnes = (substring(r.label from '(\d+(?:\.\d+)?)\s*T\s*inc'))::numeric
FROM public.pricing_rate_card_rows r
WHERE v.row_id = r.id AND v.included_tonnes IS NULL
  AND r.section ~* 'ro\s*-?\s*ro' AND r.label ~* '\d+(\.\d+)?\s*T\s*inc';