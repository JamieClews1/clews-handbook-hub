
-- Allow authenticated users to delete stock report items (needed for edit/delete flows)
CREATE POLICY "Authenticated users can delete stock report items"
ON public.stock_report_items
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to update stock report items
CREATE POLICY "Authenticated users can update stock report items"
ON public.stock_report_items
FOR UPDATE
USING (auth.uid() IS NOT NULL);
