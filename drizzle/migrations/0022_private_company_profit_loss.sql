CREATE OR REPLACE FUNCTION public.has_company_pl_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT _user_id IN ('09ee800b-b7b2-4c81-9eb5-9ec11c472516'::uuid, 'a3a66a1c-c247-4803-8a56-634b568bd286'::uuid)
 AND public.is_finance_user(_user_id)
 AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_archived IS NOT TRUE);
$$;
REVOKE ALL ON FUNCTION public.has_company_pl_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_company_pl_access(uuid) TO authenticated, service_role;
CREATE TABLE public.company_pl_workbooks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 file_name text NOT NULL,
 sheets jsonb NOT NULL,
 imported_by uuid NOT NULL DEFAULT auth.uid(),
 imported_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT company_pl_sheets_object CHECK (jsonb_typeof(sheets) = 'object' AND sheets <> '{}'::jsonb AND (sheets - ARRAY['Full set','Clews EBITDA','RFS EBITDA']::text[]) = '{}'::jsonb)
);
GRANT SELECT, INSERT ON public.company_pl_workbooks TO authenticated;
GRANT ALL ON public.company_pl_workbooks TO service_role;
ALTER TABLE public.company_pl_workbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jamie reads company P&L" ON public.company_pl_workbooks FOR SELECT TO authenticated USING (public.has_company_pl_access(auth.uid()));
CREATE POLICY "Jamie imports company P&L" ON public.company_pl_workbooks FOR INSERT TO authenticated WITH CHECK (public.has_company_pl_access(auth.uid()) AND imported_by = auth.uid());