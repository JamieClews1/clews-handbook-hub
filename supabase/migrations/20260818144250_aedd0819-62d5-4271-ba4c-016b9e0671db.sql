CREATE TABLE IF NOT EXISTS public.pda_upload_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  require_job_prefix boolean NOT NULL DEFAULT true,
  replace_existing boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pda_upload_settings TO authenticated;
GRANT ALL ON public.pda_upload_settings TO service_role;
ALTER TABLE public.pda_upload_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can read pda upload settings" ON public.pda_upload_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can manage pda upload settings" ON public.pda_upload_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO public.pda_upload_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;