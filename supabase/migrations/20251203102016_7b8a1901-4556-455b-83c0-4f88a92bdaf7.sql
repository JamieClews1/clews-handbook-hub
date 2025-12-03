-- Allow management users to view all profiles for mass sign-off
CREATE POLICY "Management can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND 'management' = ANY(p.user_types)
  )
);