
-- Settings table for Live Jobs configuration
CREATE TABLE public.live_jobs_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_jobs_settings ENABLE ROW LEVEL SECURITY;

-- Only admin/management can manage settings
CREATE POLICY "Admin/management can manage live jobs settings"
ON public.live_jobs_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view live jobs settings"
ON public.live_jobs_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_live_jobs_settings_updated_at
BEFORE UPDATE ON public.live_jobs_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default values
INSERT INTO public.live_jobs_settings (setting_key, setting_value, description) VALUES
  ('rental_free_days', '28', 'Number of free rental days before a site is flagged as over rental'),
  ('artic_vehicle_regs', '["FG61 SYV", "FJ18 FDM"]', 'Vehicle registrations that identify waste truck (artic) movements'),
  ('artic_container_keywords', '["curtain side", "walking floor", "bulk ejector", "artic haulage"]', 'Container type keywords that identify waste truck (artic) movements'),
  ('roro_container_keywords', '["ro ro", "roll on roll off", "ro ro haulage"]', 'Container type keywords that identify RoRo movements'),
  ('skip_container_keywords', '["skip", "yard", "yd", "chain lift"]', 'Container type keywords that identify Skip movements'),
  ('waste_truck_months', '6', 'Number of months to look back for waste truck site visits');
