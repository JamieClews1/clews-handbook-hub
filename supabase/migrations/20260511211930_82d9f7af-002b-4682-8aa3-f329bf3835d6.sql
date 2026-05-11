-- Allow any authenticated staff to edit submitted stock checks (needed for "Edit last tally")
DROP POLICY IF EXISTS "Users can update their own draft checks" ON public.stock_checks;
CREATE POLICY "Staff can update stock checks"
ON public.stock_checks
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow staff to manage (insert/update/delete) items on any stock check
DROP POLICY IF EXISTS "Users can manage items for their stock checks" ON public.stock_check_items;
CREATE POLICY "Staff can manage stock check items"
ON public.stock_check_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);