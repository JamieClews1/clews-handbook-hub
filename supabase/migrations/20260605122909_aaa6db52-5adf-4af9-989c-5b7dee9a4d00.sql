-- 1. Credit applications: remove broken public policies (data now served via service-role edge function)
DROP POLICY IF EXISTS "Public can view via share token" ON public.credit_account_applications;
DROP POLICY IF EXISTS "Public can submit via share token" ON public.credit_account_applications;

-- 2. Partner questionnaires: remove broken public policies
DROP POLICY IF EXISTS "Public can view and submit via share token" ON public.partner_questionnaires;
DROP POLICY IF EXISTS "Public can update pending questionnaires via share token" ON public.partner_questionnaires;

-- 3. Company profile: restrict sensitive financial/banking data to admin & management only
DROP POLICY IF EXISTS "Authenticated users can view company profile" ON public.company_profile;

CREATE POLICY "Admins can view company profile"
ON public.company_profile FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management can view company profile"
ON public.company_profile FOR SELECT
TO authenticated
USING (is_management(auth.uid()));

-- 4. Contamination activity log: scope anonymous inserts to valid query references and a known action set
DROP POLICY IF EXISTS "Anon can insert activity log" ON public.contamination_activity_log;

CREATE POLICY "Anon can insert scoped activity log"
ON public.contamination_activity_log FOR INSERT
TO anon
WITH CHECK (
  query_id IN (SELECT id FROM public.contamination_queries)
  AND action_type IN ('created', 'updated', 'submitted', 'contamination_reported')
);