-- =============== TEAM MEMBERS ===============
CREATE TABLE public.crm_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  personal_email text NOT NULL,
  initials text,
  is_active boolean NOT NULL DEFAULT true,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_team_members TO authenticated;
GRANT ALL ON public.crm_team_members TO service_role;
ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage team members" ON public.crm_team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== TICKETS ===============
CREATE TABLE public.crm_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_conversation_id text,
  graph_message_id text,
  subject text,
  sender_name text,
  sender_email text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','pending','resolved')),
  assigned_to uuid REFERENCES public.crm_team_members(id) ON DELETE SET NULL,
  snippet text,
  is_read boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_tickets_conversation_uniq ON public.crm_tickets (graph_conversation_id) WHERE graph_conversation_id IS NOT NULL;
CREATE INDEX crm_tickets_status_idx ON public.crm_tickets (status);
CREATE INDEX crm_tickets_assigned_idx ON public.crm_tickets (assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tickets TO authenticated;
GRANT ALL ON public.crm_tickets TO service_role;
ALTER TABLE public.crm_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage tickets" ON public.crm_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== TICKET MESSAGES ===============
CREATE TABLE public.crm_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text,
  body_preview text,
  from_name text,
  from_email text,
  sent_by uuid REFERENCES public.crm_team_members(id) ON DELETE SET NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  graph_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_ticket_messages_ticket_idx ON public.crm_ticket_messages (ticket_id, sent_at);
CREATE UNIQUE INDEX crm_ticket_messages_graph_uniq ON public.crm_ticket_messages (graph_message_id) WHERE graph_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_ticket_messages TO authenticated;
GRANT ALL ON public.crm_ticket_messages TO service_role;
ALTER TABLE public.crm_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ticket messages" ON public.crm_ticket_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== EMAIL TEMPLATES (CRM) ===============
CREATE TABLE public.crm_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  subject text,
  body text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_templates TO authenticated;
GRANT ALL ON public.crm_email_templates TO service_role;
ALTER TABLE public.crm_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage crm templates" ON public.crm_email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== PRICING ===============
CREATE TABLE public.crm_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL,
  grade text,
  unit text,
  current_price numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pricing TO authenticated;
GRANT ALL ON public.crm_pricing TO service_role;
ALTER TABLE public.crm_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage crm pricing" ON public.crm_pricing
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== PRICING HISTORY ===============
CREATE TABLE public.crm_pricing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id uuid NOT NULL REFERENCES public.crm_pricing(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pricing_history TO authenticated;
GRANT ALL ON public.crm_pricing_history TO service_role;
ALTER TABLE public.crm_pricing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view pricing history" ON public.crm_pricing_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== ASSIGNMENT LOG ===============
CREATE TABLE public.crm_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.crm_team_members(id) ON DELETE SET NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_assignment_log_ticket_idx ON public.crm_assignment_log (ticket_id, assigned_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_assignment_log TO authenticated;
GRANT ALL ON public.crm_assignment_log TO service_role;
ALTER TABLE public.crm_assignment_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage assignment log" ON public.crm_assignment_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============== updated_at triggers ===============
CREATE TRIGGER trg_crm_team_members_updated BEFORE UPDATE ON public.crm_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_tickets_updated BEFORE UPDATE ON public.crm_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_email_templates_updated BEFORE UPDATE ON public.crm_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_pricing_updated BEFORE UPDATE ON public.crm_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();