CREATE TABLE public.pod_source_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT,
  path TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pod_source_folders TO authenticated;
GRANT ALL ON public.pod_source_folders TO service_role;

ALTER TABLE public.pod_source_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pod source folders"
ON public.pod_source_folders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and management manage pod source folders"
ON public.pod_source_folders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE TRIGGER update_pod_source_folders_updated_at
BEFORE UPDATE ON public.pod_source_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pod_source_folders (label, path, is_default)
VALUES ('SkipTrak PDFs', '\\sbs2011\Midsoft\SkipTrak\pdf', true);