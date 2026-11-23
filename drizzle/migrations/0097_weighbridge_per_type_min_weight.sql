-- Per-waste-type minimum charge weight. Blank = use the site default (350 kg).
ALTER TABLE public.weighbridge_waste_types
  ADD COLUMN IF NOT EXISTS min_weight_kg numeric CHECK (min_weight_kg IS NULL OR (min_weight_kg >= 0 AND min_weight_kg <= 10000));

COMMENT ON COLUMN public.weighbridge_waste_types.min_weight_kg IS
  'Minimum chargeable weight (kg) for this waste type; NULL = use weighbridge_pricing_settings.min_charge_weight_kg (350 default)';

-- Effective minimum weight for a waste type: its own value when set, otherwise the site default.
CREATE OR REPLACE FUNCTION public.weighbridge_effective_min_weight_kg(_waste_type_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT t.min_weight_kg FROM public.weighbridge_waste_types t WHERE t.id = _waste_type_id),
    (SELECT s.min_charge_weight_kg FROM public.weighbridge_pricing_settings s LIMIT 1),
    350
  )
$$;

-- Minimum £ charge for a price, honouring the waste type's own minimum weight when it has one.
CREATE OR REPLACE FUNCTION public.weighbridge_min_charge_for_type(_price numeric, _waste_type_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(coalesce(_price, 0) * public.weighbridge_effective_min_weight_kg(_waste_type_id) / 1000, 2)
$$;

COMMENT ON FUNCTION public.weighbridge_min_charge_for(numeric) IS
  'DEPRECATED: use weighbridge_min_charge_for_type(price, waste_type_id), which honours per-type min_weight_kg';

-- Waste type rows: derive min_charge from the type's own effective minimum weight.
CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(NEW.min_weight_exempt, false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for_type(NEW.price_per_tonne, NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- Rate-group overrides: same rule, using the waste type's effective minimum weight.
CREATE OR REPLACE FUNCTION public.weighbridge_group_price_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce((SELECT min_weight_exempt FROM public.weighbridge_waste_types WHERE id = NEW.waste_type_id), false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for_type(NEW.price_per_tonne, NEW.waste_type_id);
  END IF;
  RETURN NEW;
END $$;

-- When a type's exemption or minimum weight changes, refresh its minimum charge in every rate group.
CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_exempt_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.weighbridge_rate_group_prices SET min_charge = min_charge WHERE waste_type_id = NEW.id;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.weighbridge_effective_min_weight_kg(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_min_charge_for_type(numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_waste_type_min_charge() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_group_price_min_charge() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_waste_type_exempt_changed() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS weighbridge_waste_types_exempt_changed ON public.weighbridge_waste_types;
CREATE TRIGGER weighbridge_waste_types_exempt_changed
  AFTER UPDATE OF min_weight_exempt, min_weight_kg ON public.weighbridge_waste_types
  FOR EACH ROW
  WHEN (OLD.min_weight_exempt IS DISTINCT FROM NEW.min_weight_exempt OR OLD.min_weight_kg IS DISTINCT FROM NEW.min_weight_kg)
  EXECUTE FUNCTION public.weighbridge_waste_type_exempt_changed();

-- Backfill: restate every non-exempt minimum charge through the new rule (unchanged where no per-type weight is set).
UPDATE public.weighbridge_waste_types SET min_charge = min_charge;
UPDATE public.weighbridge_rate_group_prices SET min_charge = min_charge;