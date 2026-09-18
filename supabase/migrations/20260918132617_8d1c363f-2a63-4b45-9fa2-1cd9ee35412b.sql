ALTER POLICY "Anyone can view rams" ON public.rams USING (public.is_staff(auth.uid()));
ALTER POLICY "Anyone can view rams_hazards" ON public.rams_hazards USING (public.is_staff(auth.uid()));
ALTER POLICY "Anyone can view toolbox talks" ON public.toolbox_talks USING (public.is_staff(auth.uid()));