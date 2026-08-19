CREATE TABLE IF NOT EXISTS public.crm_auto_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exclude_website_enquiries boolean NOT NULL DEFAULT true,
  exclude_patterns text[] NOT NULL DEFAULT ARRAY['clewsrecycling.co.uk','website enquiry','contact form','wordpress'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_auto_reply_rules TO authenticated;
GRANT ALL ON public.crm_auto_reply_rules TO service_role;
ALTER TABLE public.crm_auto_reply_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage auto reply rules" ON public.crm_auto_reply_rules;
CREATE POLICY "Staff can manage auto reply rules" ON public.crm_auto_reply_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.crm_auto_reply_rules (id) SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM public.crm_auto_reply_rules);