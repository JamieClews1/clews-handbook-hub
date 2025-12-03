-- Allow management users to insert RAMS signatures on behalf of other users
CREATE POLICY "Management can insert RAMS signatures for users"
ON public.rams_user_signatures
FOR INSERT
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));