CREATE TABLE public.po_pending_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  changed_by TEXT,
  notification_email TEXT,
  job_id UUID NOT NULL,
  site_name TEXT,
  job_number TEXT NOT NULL,
  job_date TEXT,
  old_po_number TEXT,
  new_po_number TEXT NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX po_pending_changes_unique_pending
  ON public.po_pending_changes (user_id, job_id)
  WHERE sent = false;

CREATE INDEX po_pending_changes_flush_idx
  ON public.po_pending_changes (sent, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_pending_changes TO authenticated;
GRANT ALL ON public.po_pending_changes TO service_role;

ALTER TABLE public.po_pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pending PO changes"
  ON public.po_pending_changes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_po_pending_changes_updated_at
  BEFORE UPDATE ON public.po_pending_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();