-- ============ PRICING MATRIX CMS ============
CREATE TABLE public.contamination_waste_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  typical_contamination text,
  zero_tolerance boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contamination_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_type_id uuid NOT NULL REFERENCES public.contamination_waste_types(id) ON DELETE CASCADE,
  tier_name text NOT NULL,
  pct_min numeric,
  pct_max numeric,
  mins_min numeric,
  mins_max numeric,
  flat_fee numeric NOT NULL DEFAULT 0,
  per_tonne_fee numeric,
  min_charge_tonnes numeric,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contamination_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_report integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contamination_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES public.contamination_queries(id) ON DELETE CASCADE,
  driver_id uuid,
  reporter_name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  reason text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT ON public.contamination_waste_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contamination_waste_types TO authenticated;
GRANT ALL ON public.contamination_waste_types TO service_role;

GRANT SELECT ON public.contamination_pricing_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contamination_pricing_tiers TO authenticated;
GRANT ALL ON public.contamination_pricing_tiers TO service_role;

GRANT SELECT ON public.contamination_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contamination_settings TO authenticated;
GRANT ALL ON public.contamination_settings TO service_role;

GRANT SELECT, INSERT ON public.contamination_points TO anon, authenticated;
GRANT UPDATE, DELETE ON public.contamination_points TO authenticated;
GRANT ALL ON public.contamination_points TO service_role;

-- ============ RLS ============
ALTER TABLE public.contamination_waste_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contamination_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contamination_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contamination_points ENABLE ROW LEVEL SECURITY;

-- Waste types: everyone reads (driver app uses anon), admins/management manage
CREATE POLICY "Anyone can view waste types" ON public.contamination_waste_types FOR SELECT USING (true);
CREATE POLICY "Admin/management manage waste types" ON public.contamination_waste_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Anyone can view pricing tiers" ON public.contamination_pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Admin/management manage pricing tiers" ON public.contamination_pricing_tiers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Anyone can view contamination settings" ON public.contamination_settings FOR SELECT USING (true);
CREATE POLICY "Admin/management manage contamination settings" ON public.contamination_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Points: authenticated read; anon+authenticated insert (driver app awards points); admin/management manage
CREATE POLICY "Authenticated can view points" ON public.contamination_points FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anon can insert points" ON public.contamination_points FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can insert points" ON public.contamination_points FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin/management manage points" ON public.contamination_points FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- ============ EXTEND contamination_queries ============
ALTER TABLE public.contamination_queries
  ADD COLUMN reporter_driver_id uuid,
  ADD COLUMN reporter_name text,
  ADD COLUMN reporter_type text,
  ADD COLUMN waste_type_id uuid,
  ADD COLUMN pricing_tier_id uuid,
  ADD COLUMN contamination_pct numeric,
  ADD COLUMN sorting_minutes numeric,
  ADD COLUMN calculated_charge numeric,
  ADD COLUMN charge_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN override_reason text,
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approver_name text,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN rejection_reason text,
  ADD COLUMN customer_signature text,
  ADD COLUMN customer_signoff_name text,
  ADD COLUMN customer_signoff_role text,
  ADD COLUMN customer_signoff_at timestamptz,
  ADD COLUMN points_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN source_app text NOT NULL DEFAULT 'portal';

-- Backfill: treat existing non-new rows as already approved so the new gate doesn't block historic work
UPDATE public.contamination_queries
  SET approval_status = 'approved'
  WHERE status IN ('actioned','complete','resolved');

-- Allow driver app (anon) to create + update contamination queries
CREATE POLICY "Anon can insert contamination queries" ON public.contamination_queries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update contamination queries" ON public.contamination_queries FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow driver app (anon) to log activity
CREATE POLICY "Anon can insert activity log" ON public.contamination_activity_log FOR INSERT TO anon WITH CHECK (true);
GRANT INSERT ON public.contamination_activity_log TO anon;
GRANT INSERT, UPDATE ON public.contamination_queries TO anon;

-- timestamp triggers
CREATE TRIGGER trg_waste_types_updated BEFORE UPDATE ON public.contamination_waste_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pricing_tiers_updated BEFORE UPDATE ON public.contamination_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cont_settings_updated BEFORE UPDATE ON public.contamination_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED ============
INSERT INTO public.contamination_settings (points_per_report) VALUES (10);

-- Waste types from CLEWS 2025 penalty table
INSERT INTO public.contamination_waste_types (name, typical_contamination, zero_tolerance, display_order) VALUES
  ('Inert', 'ZERO TOLERANCE CONTAMINATION', true, 1),
  ('Wood', 'General waste contamination', false, 2),
  ('Plasterboard', 'General waste contamination', false, 3),
  ('General Waste', 'Plasterboard / Food / Soil contamination', false, 4),
  ('Cardboard / Papers', 'General waste contamination. ZERO TOLERANCE FOOD WASTE', false, 5),
  ('Mixed Recyclables', 'General waste contamination', false, 6);

-- Tiers
-- Inert (zero tolerance, single penalty tier)
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, 'Penalty (0% Tolerance)', 0, NULL, NULL, NULL, 100, 35, NULL, '6YD Skip: £100 fee / RoRo: £35/T fee', 1
FROM public.contamination_waste_types WHERE name = 'Inert';

-- Wood
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, t.tier_name, t.pct_min, t.pct_max, t.mins_min, t.mins_max, t.flat_fee, t.per_tonne_fee, t.min_charge_tonnes, t.notes, t.display_order
FROM public.contamination_waste_types w
CROSS JOIN (VALUES
  ('Tolerance', 0::numeric, 1::numeric, 0::numeric, 5::numeric, 0::numeric, NULL::numeric, NULL::numeric, 'Within tolerance — no charge', 1),
  ('Tier 1', 2, 5, 6, 15, 35, NULL, NULL, NULL, 2),
  ('Tier 2', 6, 10, 16, 30, 55, NULL, NULL, NULL, 3),
  ('Tier 3', 11, NULL, 31, NULL, 0, 35, NULL, 'Recharged at General Waste fee (£35/T)', 4)
) AS t(tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
WHERE w.name = 'Wood';

-- Plasterboard
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, t.tier_name, t.pct_min, t.pct_max, t.mins_min, t.mins_max, t.flat_fee, t.per_tonne_fee, t.min_charge_tonnes, t.notes, t.display_order
FROM public.contamination_waste_types w
CROSS JOIN (VALUES
  ('Tolerance', 0::numeric, 1::numeric, 0::numeric, 5::numeric, 0::numeric, NULL::numeric, NULL::numeric, 'Within tolerance — no charge', 1),
  ('Tier 1', 2, 5, 6, 15, 35, NULL, NULL, NULL, 2),
  ('Tier 2', 6, 10, 16, 30, 55, NULL, NULL, NULL, 3),
  ('Tier 3', 11, NULL, 31, NULL, 0, 35, 3, '£35/T (Min charge 3T)', 4)
) AS t(tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
WHERE w.name = 'Plasterboard';

-- General Waste
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, t.tier_name, t.pct_min, t.pct_max, t.mins_min, t.mins_max, t.flat_fee, t.per_tonne_fee, t.min_charge_tonnes, t.notes, t.display_order
FROM public.contamination_waste_types w
CROSS JOIN (VALUES
  ('Tier 2', 0::numeric, 10::numeric, 16::numeric, 30::numeric, 75::numeric, NULL::numeric, NULL::numeric, 'Up to 10% OR 16-30 mins', 1),
  ('Tier 3', 11, NULL, 31, NULL, 0, 35, 3, '£35/T (Min charge 3T)', 2)
) AS t(tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
WHERE w.name = 'General Waste';

-- Cardboard / Papers
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, t.tier_name, t.pct_min, t.pct_max, t.mins_min, t.mins_max, t.flat_fee, t.per_tonne_fee, t.min_charge_tonnes, t.notes, t.display_order
FROM public.contamination_waste_types w
CROSS JOIN (VALUES
  ('Tolerance', 0::numeric, 3::numeric, 0::numeric, 5::numeric, 0::numeric, NULL::numeric, NULL::numeric, 'Within tolerance — no charge', 1),
  ('Tier 1', 4, 5, 6, 15, 25, NULL, NULL, NULL, 2),
  ('Tier 2', 6, 10, 16, 30, 55, NULL, NULL, NULL, 3),
  ('Tier 3', 11, NULL, 31, NULL, 0, 35, NULL, 'Recharged at General Waste fee (£35/T)', 4)
) AS t(tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
WHERE w.name = 'Cardboard / Papers';

-- Mixed Recyclables
INSERT INTO public.contamination_pricing_tiers (waste_type_id, tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
SELECT id, t.tier_name, t.pct_min, t.pct_max, t.mins_min, t.mins_max, t.flat_fee, t.per_tonne_fee, t.min_charge_tonnes, t.notes, t.display_order
FROM public.contamination_waste_types w
CROSS JOIN (VALUES
  ('Tolerance', 0::numeric, 3::numeric, 0::numeric, 5::numeric, 0::numeric, NULL::numeric, NULL::numeric, 'Within tolerance — no charge', 1),
  ('Tier 1', 4, 5, 6, 15, 25, NULL, NULL, NULL, 2),
  ('Tier 2', 6, 10, 15, 30, 55, NULL, NULL, NULL, 3),
  ('Tier 3', 11, NULL, 31, NULL, 0, 35, NULL, 'Recharged at General Waste fee (£35/T)', 4)
) AS t(tier_name, pct_min, pct_max, mins_min, mins_max, flat_fee, per_tonne_fee, min_charge_tonnes, notes, display_order)
WHERE w.name = 'Mixed Recyclables';