ALTER TABLE public.customer_site_rebate_overrides
ADD COLUMN waste_type TEXT;

COMMENT ON COLUMN public.customer_site_rebate_overrides.waste_type IS 'Optional: when set, override only applies to load line items with this exact waste_type (e.g. "Card Bales"). When NULL, applies to all waste types mapped to the rebate item.';