ALTER TABLE public.portal_section_visibility ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.section_restricted(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_section_visibility WHERE section_key = _key AND cardinality(allowed_user_ids) > 0);
$$;

CREATE OR REPLACE FUNCTION public.section_allows_user(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_section_visibility WHERE section_key = _key AND _user_id = ANY(allowed_user_ids));
$$;

CREATE OR REPLACE FUNCTION public.can_access_payroll(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.section_restricted('payroll')
    THEN public.is_staff(_user_id) AND public.section_allows_user(_user_id, 'payroll')
    ELSE public.is_finance_user(_user_id) END;
$$;

DROP POLICY IF EXISTS "Finance staff manage payroll employees" ON public.payroll_employees;
DROP POLICY IF EXISTS "Finance staff manage payroll entries" ON public.payroll_timesheet_entries;
DROP POLICY IF EXISTS "Finance staff manage payroll timesheets" ON public.payroll_timesheets;
CREATE POLICY "Payroll staff manage payroll employees" ON public.payroll_employees FOR ALL TO authenticated USING (public.can_access_payroll(auth.uid())) WITH CHECK (public.can_access_payroll(auth.uid()));
CREATE POLICY "Payroll staff manage payroll entries" ON public.payroll_timesheet_entries FOR ALL TO authenticated USING (public.can_access_payroll(auth.uid())) WITH CHECK (public.can_access_payroll(auth.uid()));
CREATE POLICY "Payroll staff manage payroll timesheets" ON public.payroll_timesheets FOR ALL TO authenticated USING (public.can_access_payroll(auth.uid())) WITH CHECK (public.can_access_payroll(auth.uid()));