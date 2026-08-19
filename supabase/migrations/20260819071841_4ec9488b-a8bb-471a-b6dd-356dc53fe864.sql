CREATE TABLE public.route_one_booking_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_label text NOT NULL,
  roro_day text,
  skip_day text,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_booking_windows TO authenticated;
GRANT ALL ON public.route_one_booking_windows TO service_role;

ALTER TABLE public.route_one_booking_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view booking windows"
ON public.route_one_booking_windows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage booking windows"
ON public.route_one_booking_windows FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_route_one_booking_windows_updated_at
BEFORE UPDATE ON public.route_one_booking_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.route_one_booking_windows (zone_label, roro_day, skip_day, sort_order)
VALUES ('Zone 1', 'FRI', 'FRI', 1), ('Zone 2 + 3', 'MON', 'MON', 2);