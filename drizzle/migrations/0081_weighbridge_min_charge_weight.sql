CREATE TABLE public.weighbridge_pricing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  min_charge_weight_kg numeric NOT NULL DEFAULT 350 CHECK (min_charge_weight_kg >= 0 AND min_charge_weight_kg <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.weighbridge_pricing_settings TO authenticated;
GRANT ALL ON public.weighbridge_pricing_settings TO service_role;
ALTER TABLE public.weighbridge_pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view weighbridge pricing settings" ON public.weighbridge_pricing_settings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert weighbridge pricing settings" ON public.weighbridge_pricing_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update weighbridge pricing settings" ON public.weighbridge_pricing_settings
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.weighbridge_pricing_settings (id, min_charge_weight_kg) VALUES (true, 350) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weighbridge_waste_types ADD COLUMN IF NOT EXISTS min_weight_exempt boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.weighbridge_waste_types.min_weight_exempt IS 'true = keeps its own £ minimum charge (soil/hardcore); false = minimum charge is the settings minimum weight x price per tonne';
UPDATE public.weighbridge_waste_types SET min_weight_exempt = true
WHERE waste_type ~* '(soil|hardcore|concrete|brick|rubble|inert|stones)'
   OR replace(coalesce(ewc_code,''), ' ', '') IN ('170101','170102','170103','170107','170504');

CREATE OR REPLACE FUNCTION public.weighbridge_min_charge_for(_price numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(coalesce(_price, 0) * coalesce((SELECT min_charge_weight_kg FROM public.weighbridge_pricing_settings LIMIT 1), 350) / 1000, 2)
$$;

CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(NEW.min_weight_exempt, false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for(NEW.price_per_tonne);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.weighbridge_group_price_min_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce((SELECT min_weight_exempt FROM public.weighbridge_waste_types WHERE id = NEW.waste_type_id), false) THEN
    NEW.min_charge := public.weighbridge_min_charge_for(NEW.price_per_tonne);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.weighbridge_waste_type_exempt_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.weighbridge_rate_group_prices SET min_charge = min_charge WHERE waste_type_id = NEW.id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.weighbridge_pricing_settings_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.weighbridge_waste_types SET min_charge = min_charge WHERE NOT min_weight_exempt;
  UPDATE public.weighbridge_rate_group_prices p SET min_charge = p.min_charge
  FROM public.weighbridge_waste_types t WHERE t.id = p.waste_type_id AND NOT t.min_weight_exempt;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.weighbridge_waste_type_min_charge() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_group_price_min_charge() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_waste_type_exempt_changed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weighbridge_pricing_settings_changed() FROM PUBLIC, anon;

CREATE TRIGGER weighbridge_waste_types_min_charge
  BEFORE INSERT OR UPDATE ON public.weighbridge_waste_types
  FOR EACH ROW EXECUTE FUNCTION public.weighbridge_waste_type_min_charge();
CREATE TRIGGER weighbridge_rate_group_prices_min_charge
  BEFORE INSERT OR UPDATE ON public.weighbridge_rate_group_prices
  FOR EACH ROW EXECUTE FUNCTION public.weighbridge_group_price_min_charge();
CREATE TRIGGER weighbridge_waste_types_exempt_changed
  AFTER UPDATE OF min_weight_exempt ON public.weighbridge_waste_types
  FOR EACH ROW WHEN (OLD.min_weight_exempt IS DISTINCT FROM NEW.min_weight_exempt)
  EXECUTE FUNCTION public.weighbridge_waste_type_exempt_changed();
CREATE TRIGGER weighbridge_pricing_settings_changed
  AFTER UPDATE OF min_charge_weight_kg ON public.weighbridge_pricing_settings
  FOR EACH ROW WHEN (OLD.min_charge_weight_kg IS DISTINCT FROM NEW.min_charge_weight_kg)
  EXECUTE FUNCTION public.weighbridge_pricing_settings_changed();

-- Backfill: apply the 350 kg minimum to every non-exempt price now.
UPDATE public.weighbridge_waste_types SET min_charge = min_charge WHERE NOT min_weight_exempt;
UPDATE public.weighbridge_rate_group_prices p SET min_charge = p.min_charge
FROM public.weighbridge_waste_types t WHERE t.id = p.waste_type_id AND NOT t.min_weight_exempt;