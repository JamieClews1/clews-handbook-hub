-- Pricing naming: "Mixed Waste" becomes "General Waste / Construction & Demolition" (agreed names: General Waste 20 03 01, Construction & Demolition 17 09 04).
-- Labels only; prices live in pricing_rate_card_values keyed by row_id and are untouched.
update public.pricing_rate_card_rows
set label = regexp_replace(label, 'mixed waste', 'General Waste / Construction & Demolition', 'gi'),
    updated_at = now()
where label ~* 'mixed waste';