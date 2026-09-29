INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::app_role FROM public.profiles p
WHERE COALESCE(array_length(p.user_types,1),0) > 0 AND COALESCE(p.is_archived,false) = false
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_staff_role_on_user_types()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(array_length(NEW.user_types,1),0) > 0
     AND (auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_management(auth.uid())) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'::app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_grant_staff_role ON public.profiles;
CREATE TRIGGER trg_grant_staff_role AFTER INSERT OR UPDATE OF user_types ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_staff_role_on_user_types();