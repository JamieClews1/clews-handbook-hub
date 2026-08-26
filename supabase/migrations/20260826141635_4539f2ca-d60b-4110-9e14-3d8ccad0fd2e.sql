CREATE POLICY "Managers sign H&S documents for staff"
ON public.hs_document_signatures
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_management(auth.uid()));