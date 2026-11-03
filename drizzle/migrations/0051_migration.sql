ALTER TABLE public.weighbridge_transactions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE public.test_mode_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.test_mode_settings TO authenticated;
GRANT ALL ON public.test_mode_settings TO service_role;
ALTER TABLE public.test_mode_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view test mode" ON public.test_mode_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage test mode" ON public.test_mode_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.test_mode_settings (enabled) VALUES (false);