-- Per-user mailbox connections
CREATE TABLE public.crm_mailbox_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ms_email text NOT NULL,
  ms_display_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Column-level grants: client may read connection status but NOT the tokens
GRANT SELECT (user_id, ms_email, ms_display_name, last_synced_at, created_at, updated_at) ON public.crm_mailbox_connections TO authenticated;
GRANT DELETE ON public.crm_mailbox_connections TO authenticated;
GRANT ALL ON public.crm_mailbox_connections TO service_role;

ALTER TABLE public.crm_mailbox_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mailbox connection"
  ON public.crm_mailbox_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can disconnect their own mailbox"
  ON public.crm_mailbox_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages mailbox connections"
  ON public.crm_mailbox_connections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_crm_mailbox_connections_updated_at
  BEFORE UPDATE ON public.crm_mailbox_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Short-lived OAuth handshake state (backend only)
CREATE TABLE public.crm_mailbox_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.crm_mailbox_oauth_states TO service_role;

ALTER TABLE public.crm_mailbox_oauth_states ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated => locked to clients; service_role bypasses RLS.

-- Tag tickets / messages with which user's mailbox they belong to
ALTER TABLE public.crm_tickets ADD COLUMN IF NOT EXISTS mailbox_user_id uuid;
ALTER TABLE public.crm_ticket_messages ADD COLUMN IF NOT EXISTS mailbox_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_tickets_mailbox_user ON public.crm_tickets(mailbox_user_id);