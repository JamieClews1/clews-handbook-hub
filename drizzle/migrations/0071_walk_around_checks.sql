CREATE TABLE public.walk_around_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'Unit 17, Hunters Lane Waste Transfer Station',
  inspection_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/London')::date),
  manager_name text,
  supervisor_name text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  created_by uuid DEFAULT auth.uid(),
  created_by_name text,
  submitted_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.walk_around_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.walk_around_checks(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_title text NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  state text CHECK (state IN ('acceptable','attention','na')),
  action_required text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  due_date date,
  photo_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_id, item_key)
);
CREATE INDEX idx_walk_around_items_check ON public.walk_around_check_items (check_id, position);

CREATE TABLE public.walk_around_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.walk_around_checks(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.walk_around_check_items(id) ON DELETE SET NULL,
  section_title text,
  item_label text NOT NULL,
  action_required text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  due_date date NOT NULL,
  assigned_to uuid,
  assigned_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  completed_at timestamptz,
  completed_by uuid,
  completion_notes text,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_walk_around_actions_status_due ON public.walk_around_actions (status, due_date);
CREATE INDEX idx_walk_around_actions_check ON public.walk_around_actions (check_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.walk_around_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.walk_around_check_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.walk_around_actions TO authenticated;
GRANT ALL ON public.walk_around_checks TO service_role;
GRANT ALL ON public.walk_around_check_items TO service_role;
GRANT ALL ON public.walk_around_actions TO service_role;

ALTER TABLE public.walk_around_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_around_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_around_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view walk around checks" ON public.walk_around_checks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create walk around checks" ON public.walk_around_checks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND status = 'draft');
CREATE POLICY "Staff edit draft walk around checks" ON public.walk_around_checks
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND (status = 'draft' OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete draft walk around checks" ON public.walk_around_checks
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND (status = 'draft' OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Staff view walk around items" ON public.walk_around_check_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add items to draft checks" ON public.walk_around_check_items
  FOR INSERT TO authenticated WITH CHECK (
    public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.walk_around_checks c WHERE c.id = check_id AND c.status = 'draft'));
CREATE POLICY "Staff edit items on draft checks" ON public.walk_around_check_items
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.walk_around_checks c WHERE c.id = check_id AND c.status = 'draft'))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete items on draft checks" ON public.walk_around_check_items
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.walk_around_checks c WHERE c.id = check_id AND c.status = 'draft'));

CREATE POLICY "Staff view walk around actions" ON public.walk_around_actions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create walk around actions" ON public.walk_around_actions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update walk around actions" ON public.walk_around_actions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete walk around actions" ON public.walk_around_actions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_walk_around_checks_updated BEFORE UPDATE ON public.walk_around_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_walk_around_items_updated BEFORE UPDATE ON public.walk_around_check_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_walk_around_actions_updated BEFORE UPDATE ON public.walk_around_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.submit_walk_around_check(_check_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _status text;
  _missing integer;
  _incomplete integer;
  _created integer;
BEGIN
  SELECT status INTO _status FROM public.walk_around_checks WHERE id = _check_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Walk around check not found'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'This check has already been submitted'; END IF;

  SELECT count(*) FILTER (WHERE state IS NULL),
         count(*) FILTER (WHERE state = 'attention' AND (coalesce(btrim(action_required), '') = '' OR due_date IS NULL))
    INTO _missing, _incomplete
    FROM public.walk_around_check_items WHERE check_id = _check_id;
  IF _missing > 0 THEN RAISE EXCEPTION '% item(s) still need marking', _missing; END IF;
  IF _incomplete > 0 THEN RAISE EXCEPTION '% item(s) needing attention have no action or due date', _incomplete; END IF;

  INSERT INTO public.walk_around_actions (check_id, item_id, section_title, item_label, action_required, priority, due_date, photo_path)
  SELECT check_id, id, section_title, label, btrim(action_required), priority, due_date, photo_path
    FROM public.walk_around_check_items
   WHERE check_id = _check_id AND state = 'attention'
   ORDER BY position;
  GET DIAGNOSTICS _created = ROW_COUNT;

  UPDATE public.walk_around_checks
     SET status = 'submitted', submitted_at = now(), submitted_by = auth.uid()
   WHERE id = _check_id;
  RETURN _created;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_walk_around_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_walk_around_check(uuid) TO authenticated, service_role;

CREATE POLICY "Staff read walk around photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'walk-around-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload walk around photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'walk-around-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete walk around photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'walk-around-photos' AND public.is_staff(auth.uid()));