CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own conversations" ON public.assistant_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.assistant_conversations (user_id, updated_at DESC);

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages" ON public.assistant_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.assistant_messages (conversation_id, created_at);

CREATE TABLE public.assistant_saved_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_saved_prompts TO authenticated;
GRANT ALL ON public.assistant_saved_prompts TO service_role;
ALTER TABLE public.assistant_saved_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or shared prompts" ON public.assistant_saved_prompts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (is_shared AND public.is_staff(auth.uid())));
CREATE POLICY "Insert own prompts" ON public.assistant_saved_prompts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (NOT is_shared OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Update own prompts" ON public.assistant_saved_prompts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND (NOT is_shared OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Delete own prompts" ON public.assistant_saved_prompts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Read-only dashboard summary (no writes). Staff only.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(_day date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; prev date := _day - 7;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT jsonb_build_object(
    'jobs_today', (SELECT count(*) FROM data_hub_jobs WHERE source='skiptrak' AND job_date=_day),
    'jobs_prev', (SELECT count(*) FROM data_hub_jobs WHERE source='skiptrak' AND job_date=prev),
    'tonnes_in_today', (SELECT coalesce(sum(weight_t),0)/1000.0 FROM data_hub_jobs WHERE source='midweigh' AND job_date=_day AND upper(coalesce(movement_type,''))='INWARD'),
    'tonnes_in_prev', (SELECT coalesce(sum(weight_t),0)/1000.0 FROM data_hub_jobs WHERE source='midweigh' AND job_date=prev AND upper(coalesce(movement_type,''))='INWARD'),
    'drivers_today', (SELECT count(DISTINCT nullif(trim(driver),'')) FROM data_hub_jobs WHERE source='skiptrak' AND job_date=_day),
    'drivers_prev', (SELECT count(DISTINCT nullif(trim(driver),'')) FROM data_hub_jobs WHERE source='skiptrak' AND job_date=prev),
    'crm_open', (SELECT count(*) FROM crm_tickets WHERE status IN ('new','pending')),
    'crm_unassigned', (SELECT count(*) FROM crm_tickets WHERE status IN ('new','pending') AND assigned_to IS NULL),
    'contaminations_open', (SELECT count(*) FROM contamination_queries WHERE status='query'),
    'contaminations_no_charge', (SELECT count(*) FROM contamination_queries WHERE status='query' AND coalesce(charge_amount,0)=0 AND coalesce(calculated_charge,0)=0),
    'permits_expiring', (SELECT count(*) FROM permit_applications WHERE expiry_date BETWEEN _day AND _day+30),
    'skiptrak_last_sync', (SELECT max(updated_at) FROM data_hub_jobs WHERE source='skiptrak'),
    'midweigh_last_sync', (SELECT max(updated_at) FROM data_hub_jobs WHERE source='midweigh')
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(date) TO authenticated;