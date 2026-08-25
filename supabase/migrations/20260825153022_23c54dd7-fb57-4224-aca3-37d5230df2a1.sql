CREATE TABLE public.wtn_ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default',
  html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wtn_ticket_templates TO authenticated;
GRANT ALL ON public.wtn_ticket_templates TO service_role;

ALTER TABLE public.wtn_ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view WTN templates"
ON public.wtn_ticket_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage WTN templates"
ON public.wtn_ticket_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_wtn_ticket_templates_updated_at
BEFORE UPDATE ON public.wtn_ticket_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();