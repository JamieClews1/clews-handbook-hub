CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid UNIQUE REFERENCES public.crm_tickets(id) ON DELETE SET NULL,
  customer_id uuid,
  title text,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','quoted','won','completed','lost')),
  value_net numeric,
  postcode text,
  container text,
  waste_type text,
  assigned_to uuid REFERENCES public.crm_team_members(id) ON DELETE SET NULL,
  quoted_at timestamptz,
  won_at timestamptz,
  closed_at timestamptz,
  lost_reason text,
  route_one_job_number text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_deals_stage_idx ON public.crm_deals(stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deals TO authenticated;
GRANT ALL ON public.crm_deals TO service_role;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage deals" ON public.crm_deals FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER crm_deals_updated BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.crm_create_deal_for_quote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.intent = 'quote' AND COALESCE(NEW.is_filed,false) = false
     AND (TG_OP = 'INSERT' OR OLD.intent IS DISTINCT FROM NEW.intent) THEN
    INSERT INTO public.crm_deals (ticket_id, customer_id, title, assigned_to, postcode, container, waste_type)
    VALUES (NEW.id, NEW.customer_id, NEW.subject, NEW.assigned_to,
      NEW.ai_extracted->>'postcode', NEW.ai_extracted->>'container_size', NEW.ai_extracted->>'waste_type')
    ON CONFLICT (ticket_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_tickets_quote_deal AFTER INSERT OR UPDATE OF intent ON public.crm_tickets
  FOR EACH ROW EXECUTE FUNCTION public.crm_create_deal_for_quote();

INSERT INTO public.crm_deals (ticket_id, customer_id, title, assigned_to, postcode, container, waste_type, created_at)
SELECT id, customer_id, subject, assigned_to, ai_extracted->>'postcode', ai_extracted->>'container_size', ai_extracted->>'waste_type', COALESCE(last_message_at, now())
FROM public.crm_tickets WHERE intent = 'quote' AND COALESCE(is_filed,false) = false
ON CONFLICT (ticket_id) DO NOTHING;