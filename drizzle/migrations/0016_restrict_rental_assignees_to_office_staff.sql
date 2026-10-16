CREATE OR REPLACE FUNCTION public.validate_rental_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN RETURN NEW; END IF;
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.assigned_to
      AND COALESCE(p.is_archived, false) = false
      AND 'office' = ANY(p.user_types)
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
  ) THEN
    RAISE EXCEPTION 'Only active Clews Recycling Office users can be assigned rental tasks' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_rental_assignee() FROM PUBLIC;
CREATE TRIGGER validate_rental_assignee BEFORE INSERT OR UPDATE OF assigned_to ON public.rental_chases FOR EACH ROW EXECUTE FUNCTION public.validate_rental_assignee();