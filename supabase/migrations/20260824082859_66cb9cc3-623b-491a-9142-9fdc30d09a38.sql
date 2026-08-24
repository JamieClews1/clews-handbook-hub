CREATE TABLE public.skip_tracker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_clear_photo_tag boolean NOT NULL DEFAULT true,
  photos_required integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skip_tracker_settings TO authenticated;
GRANT SELECT ON public.skip_tracker_settings TO anon;
GRANT ALL ON public.skip_tracker_settings TO service_role;

ALTER TABLE public.skip_tracker_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage skip tracker settings"
ON public.skip_tracker_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read skip tracker settings"
ON public.skip_tracker_settings FOR SELECT TO anon
USING (true);

CREATE TRIGGER update_skip_tracker_settings_updated_at
BEFORE UPDATE ON public.skip_tracker_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.skip_tracker_settings DEFAULT VALUES;