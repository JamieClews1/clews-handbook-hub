CREATE OR REPLACE FUNCTION public.validate_rental_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN RETURN NEW; END IF;
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.assigned_to
      AND COALESCE(p.is_archived, false) = false
      AND p.left_at IS NULL
      AND 'office' = ANY(p.user_types)
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
  ) THEN
    RAISE EXCEPTION 'Only active Clews Recycling Office users can be assigned rental tasks' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;