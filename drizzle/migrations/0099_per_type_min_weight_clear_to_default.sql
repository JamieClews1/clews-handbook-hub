-- Clearing a waste type's own minimum weight must fall back to the SITE default, not to the
-- row's previously stored value (which a BEFORE UPDATE trigger can still see).
CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _kg numeric;
BEGIN
  IF NOT coalesce(NEW.min_weight_exempt, false) THEN
    _kg := coalesce(
      NEW.min_weight_kg,
      (SELECT s.min_charge_weight_kg FROM public.weighbridge_pricing_settings s LIMIT 1),
      350
    );
    NEW.min_charge := round(coalesce(NEW.price_per_tonne, 0) * _kg / 1000, 2);
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.weighbridge_min_charge_for_price(numeric, uuid, numeric) IS
  'Minimum charge for a price: explicit weight, else the waste type stored minimum weight, else the site default. Used by rate-group overrides, where the waste type row is already committed.';

-- Restate every stored minimum charge through the corrected rule.
UPDATE public.weighbridge_waste_types SET min_charge = min_charge;
UPDATE public.weighbridge_rate_group_prices SET min_charge = min_charge;