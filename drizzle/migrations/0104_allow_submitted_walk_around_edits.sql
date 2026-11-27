DROP POLICY IF EXISTS "Staff edit draft walk around checks" ON public.walk_around_checks;
CREATE POLICY "Staff edit walk around checks" ON public.walk_around_checks
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff edit items on draft checks" ON public.walk_around_check_items;
CREATE POLICY "Staff edit walk around items" ON public.walk_around_check_items
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff add items to draft checks" ON public.walk_around_check_items;
CREATE POLICY "Staff add walk around items" ON public.walk_around_check_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (
      section_key = 'additional'
      OR EXISTS (
        SELECT 1 FROM public.walk_around_checks c
        WHERE c.id = check_id AND c.status = 'draft'
      )
    )
  );

DROP POLICY IF EXISTS "Staff delete items on draft checks" ON public.walk_around_check_items;
CREATE POLICY "Staff delete walk around items" ON public.walk_around_check_items
  FOR DELETE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND (
      section_key = 'additional'
      OR EXISTS (
        SELECT 1 FROM public.walk_around_checks c
        WHERE c.id = check_id AND c.status = 'draft'
      )
    )
  );