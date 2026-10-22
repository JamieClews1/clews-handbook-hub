DROP INDEX IF EXISTS public.crm_tickets_conversation_uniq;

CREATE UNIQUE INDEX crm_tickets_conversation_uniq
  ON public.crm_tickets (graph_conversation_id, mailbox_connection_id)
  WHERE graph_conversation_id IS NOT NULL;