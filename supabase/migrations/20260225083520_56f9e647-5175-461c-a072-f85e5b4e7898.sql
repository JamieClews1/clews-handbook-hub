
-- Container types to monitor (e.g., 6yd Skip, 8yd Skip, 25/30 RoRo)
CREATE TABLE public.stock_check_container_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'skip', -- 'skip' or 'roro'
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  data_hub_keywords TEXT[] DEFAULT '{}', -- keywords to match container_type in data_hub_jobs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_check_container_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All staff can view container types"
  ON public.stock_check_container_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/management can manage container types"
  ON public.stock_check_container_types FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Main stock check record (one per check session)
CREATE TABLE public.stock_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  week_commencing DATE NOT NULL DEFAULT (date_trunc('week', CURRENT_DATE))::date,
  operator_id UUID,
  operator_name TEXT NOT NULL,
  data_hub_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All staff can view stock checks"
  ON public.stock_checks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All staff can create stock checks"
  ON public.stock_checks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own draft checks"
  ON public.stock_checks FOR UPDATE
  USING (auth.uid() = operator_id AND status = 'draft');

CREATE POLICY "Admin can update any stock check"
  ON public.stock_checks FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete stock checks"
  ON public.stock_checks FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Per-type tally items within a stock check
CREATE TABLE public.stock_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_check_id UUID NOT NULL REFERENCES public.stock_checks(id) ON DELETE CASCADE,
  container_type_id UUID NOT NULL REFERENCES public.stock_check_container_types(id),
  in_yard INTEGER NOT NULL DEFAULT 0,
  runner INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_check_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All staff can view stock check items"
  ON public.stock_check_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage items for their stock checks"
  ON public.stock_check_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.stock_checks sc
    WHERE sc.id = stock_check_items.stock_check_id
    AND (sc.operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_checks sc
    WHERE sc.id = stock_check_items.stock_check_id
    AND (sc.operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- Daily IN/OUT entries (projected from Data Hub + manual overrides)
CREATE TABLE public.stock_check_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_check_id UUID NOT NULL REFERENCES public.stock_checks(id) ON DELETE CASCADE,
  container_type_id UUID NOT NULL REFERENCES public.stock_check_container_types(id),
  entry_date DATE NOT NULL,
  projected_in INTEGER NOT NULL DEFAULT 0,
  projected_out INTEGER NOT NULL DEFAULT 0,
  actual_in INTEGER,
  actual_out INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_check_id, container_type_id, entry_date)
);

ALTER TABLE public.stock_check_daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All staff can view daily entries"
  ON public.stock_check_daily_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage daily entries for their stock checks"
  ON public.stock_check_daily_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.stock_checks sc
    WHERE sc.id = stock_check_daily_entries.stock_check_id
    AND (sc.operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_checks sc
    WHERE sc.id = stock_check_daily_entries.stock_check_id
    AND (sc.operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- Sites excluded from Data Hub projections
CREATE TABLE public.stock_check_excluded_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_check_excluded_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All staff can view excluded sites"
  ON public.stock_check_excluded_sites FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/management can manage excluded sites"
  ON public.stock_check_excluded_sites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_stock_check_container_types_updated_at
  BEFORE UPDATE ON public.stock_check_container_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_checks_updated_at
  BEFORE UPDATE ON public.stock_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_check_items_updated_at
  BEFORE UPDATE ON public.stock_check_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_check_daily_entries_updated_at
  BEFORE UPDATE ON public.stock_check_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default container types from the spreadsheet
INSERT INTO public.stock_check_container_types (name, category, display_order, data_hub_keywords) VALUES
  ('6yd', 'skip', 1, '{"6 Yard","6Yd","6 yd"}'),
  ('8yd', 'skip', 2, '{"8 Yard","8Yd","8 yd"}'),
  ('12yd', 'skip', 3, '{"12 Yard","12Yd","12 yd"}'),
  ('12yd Enclosed', 'skip', 4, '{"12 Yard Enclosed","12Yd Enclosed"}'),
  ('14/16yd', 'skip', 5, '{"14 Yard","16 Yard","14Yd","16Yd"}'),
  ('Asbestos Skip', 'skip', 6, '{"Asbestos"}'),
  ('14yd Walk-in', 'skip', 7, '{"14 Yard Walk","Walk In"}'),
  ('20yd', 'roro', 10, '{"20 Yard","20Yd","20 yd"}'),
  ('25/30yd', 'roro', 11, '{"25 Yard","30 Yard","25Yd","30Yd"}'),
  ('35/40yd', 'roro', 12, '{"35 Yard","40 Yard","35Yd","40Yd"}'),
  ('40yd Enclosed', 'roro', 13, '{"40 Yard Enclosed","40Yd Enclosed","40 Enc"}'),
  ('40yd Compactor', 'roro', 14, '{"Compactor","40 Yard Compactor","40Yd Comp"}');
