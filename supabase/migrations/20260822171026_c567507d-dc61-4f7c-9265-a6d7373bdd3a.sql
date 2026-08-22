CREATE TABLE public.fire_safety_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL,
  area text,
  phone text,
  email text,
  appointed_on date,
  training_expiry date,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_safety_people TO authenticated;
GRANT ALL ON public.fire_safety_people TO service_role;
ALTER TABLE public.fire_safety_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view fire people" ON public.fire_safety_people FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fire people" ON public.fire_safety_people FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_safety_people_updated_at BEFORE UPDATE ON public.fire_safety_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fire_weekly_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  call_point text,
  tested_by text,
  result text NOT NULL DEFAULT 'pass',
  audible_everywhere boolean NOT NULL DEFAULT true,
  defects text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_weekly_tests TO authenticated;
GRANT ALL ON public.fire_weekly_tests TO service_role;
ALTER TABLE public.fire_weekly_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view weekly tests" ON public.fire_weekly_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff log weekly tests" ON public.fire_weekly_tests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins manage weekly tests" ON public.fire_weekly_tests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE POLICY "Admins delete weekly tests" ON public.fire_weekly_tests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_weekly_tests_updated_at BEFORE UPDATE ON public.fire_weekly_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fire_equipment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_ref text,
  location text,
  frequency_days integer NOT NULL DEFAULT 30,
  last_checked_on date,
  checked_by text,
  status text NOT NULL DEFAULT 'ok',
  defects text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_equipment_checks TO authenticated;
GRANT ALL ON public.fire_equipment_checks TO service_role;
ALTER TABLE public.fire_equipment_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view equipment checks" ON public.fire_equipment_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff update equipment checks" ON public.fire_equipment_checks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins add equipment checks" ON public.fire_equipment_checks FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE POLICY "Admins delete equipment checks" ON public.fire_equipment_checks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_equipment_checks_updated_at BEFORE UPDATE ON public.fire_equipment_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fire_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_date date NOT NULL DEFAULT CURRENT_DATE,
  drill_time text,
  scenario text,
  evacuation_seconds integer,
  expected_headcount integer,
  actual_headcount integer,
  conducted_by text,
  issues text,
  actions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_drills TO authenticated;
GRANT ALL ON public.fire_drills TO service_role;
ALTER TABLE public.fire_drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view fire drills" ON public.fire_drills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fire drills" ON public.fire_drills FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_drills_updated_at BEFORE UPDATE ON public.fire_drills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fire_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Unit 17 Fire Risk Assessment',
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assessor text,
  review_due date,
  summary text,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_risk_assessments TO authenticated;
GRANT ALL ON public.fire_risk_assessments TO service_role;
ALTER TABLE public.fire_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view fire risk assessments" ON public.fire_risk_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fire risk assessments" ON public.fire_risk_assessments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_risk_assessments_updated_at BEFORE UPDATE ON public.fire_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fire_risk_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES public.fire_risk_assessments(id) ON DELETE CASCADE,
  finding text NOT NULL,
  action text,
  owner text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fire_risk_actions TO authenticated;
GRANT ALL ON public.fire_risk_actions TO service_role;
ALTER TABLE public.fire_risk_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view fire risk actions" ON public.fire_risk_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fire risk actions" ON public.fire_risk_actions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));
CREATE TRIGGER update_fire_risk_actions_updated_at BEFORE UPDATE ON public.fire_risk_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();