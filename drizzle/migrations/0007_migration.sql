ALTER TABLE public.crm_tickets
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS is_filed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_triaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_link_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_extracted jsonb;

CREATE TABLE IF NOT EXISTS public.crm_ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  triage_enabled boolean NOT NULL DEFAULT true,
  replies_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.crm_ai_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.crm_ai_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.crm_ai_settings TO authenticated;
CREATE POLICY "Staff read CRM AI settings" ON public.crm_ai_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update CRM AI settings" ON public.crm_ai_settings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Baseline: everything currently in the CRM has been handled in the shared Outlook inbox.
UPDATE public.crm_tickets SET status = 'resolved', ai_triaged_at = now() WHERE status <> 'resolved';