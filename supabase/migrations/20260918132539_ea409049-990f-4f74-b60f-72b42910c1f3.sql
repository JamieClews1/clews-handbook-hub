CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

DO $do$
DECLARE r record; stmt text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{authenticated}'
      AND (coalesce(qual,'') = 'true' OR coalesce(with_check,'') = 'true')
  LOOP
    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      stmt := stmt || ' USING (public.is_staff(auth.uid()))';
    END IF;
    IF r.with_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (public.is_staff(auth.uid()))';
    END IF;
    EXECUTE stmt;
  END LOOP;
END
$do$;