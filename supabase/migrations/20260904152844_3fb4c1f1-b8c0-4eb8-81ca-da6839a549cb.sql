ALTER TABLE public.container_loads ADD COLUMN IF NOT EXISTS load_name TEXT;

CREATE TABLE IF NOT EXISTS public.container_load_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_load_contacts TO authenticated;
GRANT ALL ON public.container_load_contacts TO service_role;

ALTER TABLE public.container_load_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view container load contacts"
  ON public.container_load_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert container load contacts"
  ON public.container_load_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update container load contacts"
  ON public.container_load_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete container load contacts"
  ON public.container_load_contacts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_container_load_contacts_updated_at
  BEFORE UPDATE ON public.container_load_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();