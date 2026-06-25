-- Skip/RoRo inventory profiles
CREATE TABLE public.skip_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number text NOT NULL,
  asset_type text NOT NULL DEFAULT 'skip',
  condition text,
  repairs_required boolean NOT NULL DEFAULT false,
  repair_notes text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_location text,
  last_skiptrak_ticket text,
  notes text,
  last_cataloged_at timestamptz,
  last_reported_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_type, asset_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_inventory TO authenticated;
GRANT ALL ON public.skip_inventory TO service_role;
ALTER TABLE public.skip_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage skip inventory"
  ON public.skip_inventory FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER update_skip_inventory_updated_at
  BEFORE UPDATE ON public.skip_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Driver cataloguing reports (Skip Tracker)
CREATE TABLE public.skip_tracker_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES public.skip_inventory(id) ON DELETE SET NULL,
  asset_number text NOT NULL,
  asset_type text NOT NULL DEFAULT 'skip',
  condition text,
  repairs_required boolean NOT NULL DEFAULT false,
  repair_notes text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  location text,
  skiptrak_ticket text,
  reporter_driver_id uuid,
  reporter_name text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_tracker_reports TO authenticated;
GRANT ALL ON public.skip_tracker_reports TO service_role;
ALTER TABLE public.skip_tracker_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read skip tracker reports"
  ON public.skip_tracker_reports FOR SELECT TO authenticated
  USING (true);

CREATE INDEX idx_skip_tracker_reports_reporter ON public.skip_tracker_reports (reporter_name, created_at);
CREATE INDEX idx_skip_tracker_reports_asset ON public.skip_tracker_reports (asset_type, asset_number, created_at);