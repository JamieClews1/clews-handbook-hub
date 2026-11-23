-- The previous helper re-read the waste type row from the table, which during a BEFORE UPDATE
-- trigger still holds the OLD value, so a type's own new minimum weight was ignored on its own save.
-- This version takes the value being written (NEW.min_weight_kg) and falls back to the stored value,
-- then the site default.
CREATE OR REPLACE FUNCTION public.weighbridge_min_charge_for_price(
  _price numeric, _waste_type_id uuid, _type_min_kg numeric DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(
    coalesce(_price, 0)
    * coalesce(_type_min_kg, public.weighbridge_effective_min_weight_kg(_waste_type_id), 350)
    / 1000, 2)
$$;

COMMENT ON FUNCTION public.weighbridge_min_charge_for_type(numeric, uuid) IS
  'DEPRECATED: use weighbridge_min_charge_for_price(price, waste_type_id, type_min_kg) so a row being updated uses its own NEW value';

-- Waste type rows: charge at the weight being written, else the site default.
CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(NEW.min_weight_exempt, false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for_price(NEW.price_per_tonne, NEW.id, NEW.min_weight_kg);
  END IF;
  RETURN NEW;
END $$;

-- Rate-group overrides: the waste type row is already committed, so its stored value is correct.
CREATE OR REPLACE FUNCTION public.weighbridge_group_price_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce((SELECT min_weight_exempt FROM public.weighbridge_waste_types WHERE id = NEW.waste_type_id), false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for_price(NEW.price_per_tonne, NEW.waste_type_id);
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.weighbridge_min_charge_for_price(numeric, uuid, numeric) FROM PUBLIC, anon;

-- Restate every stored minimum charge through the corrected rule.
UPDATE public.weighbridge_waste_types SET min_charge = min_charge;
UPDATE public.weighbridge_rate_group_prices SET min_charge = min_charge;