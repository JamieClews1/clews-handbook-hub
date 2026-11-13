CREATE TABLE public.order_portal_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  contact_name text NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  assigned_to uuid,
  staff_unread boolean NOT NULL DEFAULT true,
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_portal_conversations_last_idx ON public.order_portal_conversations (last_message_at DESC NULLS LAST);

CREATE TABLE public.order_portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.order_portal_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('customer','staff')),
  staff_user_id uuid,
  staff_name text,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_portal_messages_conv_idx ON public.order_portal_messages (conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_portal_conversations TO authenticated;
GRANT ALL ON public.order_portal_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_portal_messages TO authenticated;
GRANT ALL ON public.order_portal_messages TO service_role;

ALTER TABLE public.order_portal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage order portal conversations"
  ON public.order_portal_conversations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage order portal messages"
  ON public.order_portal_messages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER order_portal_conversations_updated_at
  BEFORE UPDATE ON public.order_portal_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff read order portal files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-portal' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload order portal files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-portal' AND public.is_staff(auth.uid()));