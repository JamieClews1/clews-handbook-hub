
CREATE TABLE public.postcode_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_name TEXT NOT NULL,
  postcodes TEXT[] NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.postcode_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read postcode_zones"
  ON public.postcode_zones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage postcode_zones"
  ON public.postcode_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
