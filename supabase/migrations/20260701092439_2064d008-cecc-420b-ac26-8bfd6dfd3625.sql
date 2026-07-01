-- Recipients that receive PO change notifications
CREATE TABLE public.po_notification_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  recipient_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_notification_recipients TO authenticated;
GRANT ALL ON public.po_notification_recipients TO service_role;

ALTER TABLE public.po_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage PO notification recipients"
ON public.po_notification_recipients FOR ALL
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Singleton config row for enabling/disabling PO notifications
CREATE TABLE public.po_notification_config (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_notification_config_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_notification_config TO authenticated;
GRANT ALL ON public.po_notification_config TO service_role;

ALTER TABLE public.po_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage PO notification config"
ON public.po_notification_config FOR ALL
TO authenticated
USING (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_management(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.po_notification_config (id, enabled) VALUES (true, true);
INSERT INTO public.po_notification_recipients (email, recipient_name) VALUES ('orders@clewsrecycling.co.uk', 'Orders');