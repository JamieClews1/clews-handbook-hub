CREATE TABLE public.yard_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_name text NOT NULL,
  staff_number integer,
  pin text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_staff TO authenticated;
GRANT ALL ON public.yard_staff TO service_role;
GRANT SELECT ON public.yard_staff TO anon;

ALTER TABLE public.yard_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read yard staff for PIN login"
  ON public.yard_staff FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Staff can manage yard staff"
  ON public.yard_staff
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE TRIGGER update_yard_staff_updated_at
  BEFORE UPDATE ON public.yard_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();