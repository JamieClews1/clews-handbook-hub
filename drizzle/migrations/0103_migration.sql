ALTER TABLE public.walk_around_check_items ADD COLUMN IF NOT EXISTS extra_photo_paths text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.walk_around_actions ADD COLUMN IF NOT EXISTS extra_photo_paths text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.submit_walk_around_check(_check_id uuid)
 RETURNS integer LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE _status text; _missing integer; _incomplete integer; _created integer;
BEGIN
  SELECT status INTO _status FROM public.walk_around_checks WHERE id = _check_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Walk around check not found'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'This check has already been submitted'; END IF;
  -- Blank additional issues added at the end are discarded rather than blocking submit.
  DELETE FROM public.walk_around_check_items
   WHERE check_id = _check_id AND section_key = 'additional'
     AND coalesce(btrim(label), '') = '' AND coalesce(btrim(action_required), '') = ''
     AND photo_path IS NULL AND cardinality(extra_photo_paths) = 0;
  SELECT count(*) FILTER (WHERE state IS NULL),
         count(*) FILTER (WHERE state = 'attention' AND (coalesce(btrim(action_required), '') = '' OR due_date IS NULL))
    INTO _missing, _incomplete
    FROM public.walk_around_check_items WHERE check_id = _check_id;
  IF _missing > 0 THEN RAISE EXCEPTION '% item(s) still need marking', _missing; END IF;
  IF _incomplete > 0 THEN RAISE EXCEPTION '% item(s) needing attention have no action or due date', _incomplete; END IF;
  INSERT INTO public.walk_around_actions (check_id, item_id, section_title, item_label, action_required, priority, due_date, photo_path, extra_photo_paths)
  SELECT check_id, id, section_title, coalesce(nullif(btrim(label), ''), 'Additional issue'), btrim(action_required), priority, due_date, photo_path, extra_photo_paths
    FROM public.walk_around_check_items
   WHERE check_id = _check_id AND state = 'attention'
   ORDER BY position;
  GET DIAGNOSTICS _created = ROW_COUNT;
  UPDATE public.walk_around_checks SET status = 'submitted', submitted_at = now(), submitted_by = auth.uid() WHERE id = _check_id;
  RETURN _created;
END;
$function$;