CREATE TABLE public.inventory_expected_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expected_skip INTEGER NOT NULL DEFAULT 0,
  expected_roro INTEGER NOT NULL DEFAULT 0,
  expected_total INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_expected_snapshot TO authenticated;
GRANT ALL ON public.inventory_expected_snapshot TO service_role;
ALTER TABLE public.inventory_expected_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read snapshots" ON public.inventory_expected_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add snapshots" ON public.inventory_expected_snapshot FOR INSERT TO authenticated WITH CHECK (true);