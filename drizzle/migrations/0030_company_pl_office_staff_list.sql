CREATE OR REPLACE FUNCTION public.list_company_pl_access()
RETURNS TABLE(user_id uuid, full_name text, email text, has_access boolean, is_manager boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_pl_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only Jamie can manage P&L access' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, public.has_company_pl_access(p.id), public.can_manage_company_pl_access(p.id)
  FROM public.profiles p
  WHERE p.is_archived IS NOT TRUE
    AND public.is_staff(p.id)
    AND 'office' = ANY(p.user_types)
  ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;
REVOKE ALL ON FUNCTION public.list_company_pl_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_company_pl_access() TO authenticated, service_role;