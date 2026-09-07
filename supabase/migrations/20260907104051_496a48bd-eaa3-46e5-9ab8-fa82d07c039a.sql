CREATE TABLE public.payroll_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_no integer,
  payroll_no text,
  first_name text NOT NULL,
  surname text NOT NULL,
  staff_group text NOT NULL DEFAULT 'yard',
  week_setup text,
  basic_rate numeric NOT NULL DEFAULT 0,
  higher_rate numeric NOT NULL DEFAULT 0,
  saturday_rate numeric NOT NULL DEFAULT 0,
  holiday_rate numeric NOT NULL DEFAULT 0,
  weekly_bonus numeric NOT NULL DEFAULT 0,
  contracted_hours numeric NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_employees TO authenticated;
GRANT ALL ON public.payroll_employees TO service_role;
ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage payroll employees" ON public.payroll_employees
  FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE UNIQUE INDEX payroll_employees_employee_no_key ON public.payroll_employees (employee_no) WHERE employee_no IS NOT NULL;

CREATE TABLE public.payroll_timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  pay_date date,
  file_name text,
  storage_path text,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  uploaded_by uuid,
  parsed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_timesheets TO authenticated;
GRANT ALL ON public.payroll_timesheets TO service_role;
ALTER TABLE public.payroll_timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage payroll timesheets" ON public.payroll_timesheets
  FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE UNIQUE INDEX payroll_timesheets_week_start_key ON public.payroll_timesheets (week_start);

CREATE TABLE public.payroll_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid NOT NULL REFERENCES public.payroll_timesheets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.payroll_employees(id) ON DELETE SET NULL,
  employee_no integer,
  employee_name text NOT NULL,
  staff_group text,
  week_setup text,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  rate_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  normal_hours numeric NOT NULL DEFAULT 0,
  higher_rate_hours numeric NOT NULL DEFAULT 0,
  saturday_hours numeric NOT NULL DEFAULT 0,
  holiday_hours numeric NOT NULL DEFAULT 0,
  holiday_days numeric NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  paid_hours numeric NOT NULL DEFAULT 0,
  adjustments numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  comments text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_timesheet_entries TO authenticated;
GRANT ALL ON public.payroll_timesheet_entries TO service_role;
ALTER TABLE public.payroll_timesheet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage payroll entries" ON public.payroll_timesheet_entries
  FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE INDEX payroll_entries_timesheet_idx ON public.payroll_timesheet_entries (timesheet_id);

CREATE TRIGGER update_payroll_employees_updated_at BEFORE UPDATE ON public.payroll_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_timesheets_updated_at BEFORE UPDATE ON public.payroll_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_entries_updated_at BEFORE UPDATE ON public.payroll_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();