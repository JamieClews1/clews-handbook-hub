
ALTER TABLE public.container_loads
  ADD COLUMN IF NOT EXISTS supplier_email text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.container_load_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_email text NOT NULL DEFAULT 'orders@clewsrecycling.co.uk',
  reply_to_email text NOT NULL DEFAULT 'orders@clewsrecycling.co.uk',
  default_subject text NOT NULL DEFAULT 'Container load {{reference}} - {{container_number}}',
  default_body text NOT NULL DEFAULT 'Hi,

Please find attached the paperwork and photos for container load {{reference}}.

Container: {{container_number}}
Seal: {{seal_number}}
Material: {{material}}
Bales: {{bale_count}}
Total weight: {{total_weight_t}} t
Destination: {{destination_facility}}, {{destination_country}}
Export date: {{export_date}}

If you have any questions, please reply to orders@clewsrecycling.co.uk.

Kind regards,
Clews Recycling',
  signature text NOT NULL DEFAULT 'Clews Recycling Ltd',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_load_email_settings TO authenticated;
GRANT ALL ON public.container_load_email_settings TO service_role;

ALTER TABLE public.container_load_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email settings"
  ON public.container_load_email_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Staff can insert email settings"
  ON public.container_load_email_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update email settings"
  ON public.container_load_email_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.container_load_email_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.container_load_email_settings);
