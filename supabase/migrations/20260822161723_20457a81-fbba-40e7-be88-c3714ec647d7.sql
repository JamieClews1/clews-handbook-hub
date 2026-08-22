CREATE TABLE public.yard_incentive_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_incentive_settings TO authenticated;
GRANT ALL ON public.yard_incentive_settings TO service_role;
ALTER TABLE public.yard_incentive_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view yard incentive settings" ON public.yard_incentive_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage yard incentive settings" ON public.yard_incentive_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_yard_incentive_settings_updated_at BEFORE UPDATE ON public.yard_incentive_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.yard_incentive_settings (setting_key, setting_value) VALUES
  ('bonus_share_pct', 20),
  ('baseline_recovery_pct', 0),
  ('target_recovery_pct', 0),
  ('team_size', 0),
  ('monthly_bonus_cap', 0)
ON CONFLICT (setting_key) DO NOTHING;