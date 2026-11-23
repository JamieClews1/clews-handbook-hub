DROP POLICY IF EXISTS "Anyone can view sections" ON public.questionnaire_sections;
CREATE POLICY "Staff can view sections" ON public.questionnaire_sections
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view fields" ON public.questionnaire_fields;
CREATE POLICY "Staff can view fields" ON public.questionnaire_fields
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.questionnaire_sections TO authenticated;
GRANT SELECT ON public.questionnaire_fields TO authenticated;
GRANT ALL ON public.questionnaire_sections TO service_role;
GRANT ALL ON public.questionnaire_fields TO service_role;