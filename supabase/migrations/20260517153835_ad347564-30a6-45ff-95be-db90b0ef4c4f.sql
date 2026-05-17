CREATE TABLE public.data_upload_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_upload_log_uploaded_at ON public.data_upload_log (uploaded_at DESC);

ALTER TABLE public.data_upload_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view upload log"
ON public.data_upload_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid())
);

CREATE POLICY "Staff can insert upload log"
ON public.data_upload_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid())
);