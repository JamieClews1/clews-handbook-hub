import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/microsoft_outlook';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionKey = Deno.env.get('MICROSOFT_OUTLOOK_API_KEY');

    // Connector not linked yet — return a clear "not connected" status so the UI can prompt setup.
    if (!lovableKey || !connectionKey) {
      return json({
        connected: false,
        synced: 0,
        message: 'Outlook mailbox is not connected yet. Link the orders@ mailbox to start syncing.',
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pull the most recent inbox messages from the connected mailbox.
    const select =
      'id,conversationId,subject,from,bodyPreview,body,receivedDateTime,isRead';
    const url =
      `${GATEWAY_URL}/me/mailFolders/inbox/messages?$top=40&$orderby=receivedDateTime desc&$select=${select}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connectionKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return json(
        { connected: true, synced: 0, error: `Graph error ${res.status}: ${text}` },
        502,
      );
    }

    const data = await res.json();
    const messages: any[] = data.value ?? [];
    let synced = 0;

    for (const m of messages) {
      const conversationId: string | null = m.conversationId ?? null;
      const graphMessageId: string = m.id;
      const subject: string = m.subject ?? '(no subject)';
      const fromName: string = m.from?.emailAddress?.name ?? '';
      const fromEmail: string = m.from?.emailAddress?.address ?? '';
      const snippet: string = m.bodyPreview ?? '';
      const bodyHtml: string = m.body?.content ?? snippet;
      const receivedAt: string = m.receivedDateTime ?? new Date().toISOString();

      // Skip messages already imported.
      const { data: existingMsg } = await supabase
        .from('crm_ticket_messages')
        .select('id')
        .eq('graph_message_id', graphMessageId)
        .maybeSingle();
      if (existingMsg) continue;

      // Find or create the ticket for this conversation.
      let ticketId: string | null = null;
      if (conversationId) {
        const { data: existingTicket } = await supabase
          .from('crm_tickets')
          .select('id')
          .eq('graph_conversation_id', conversationId)
          .maybeSingle();
        ticketId = existingTicket?.id ?? null;
      }

      if (ticketId) {
        await supabase
          .from('crm_tickets')
          .update({
            snippet,
            sender_name: fromName,
            sender_email: fromEmail,
            is_read: false,
            last_message_at: receivedAt,
          })
          .eq('id', ticketId);
      } else {
        const { data: newTicket, error: ticketErr } = await supabase
          .from('crm_tickets')
          .insert({
            graph_conversation_id: conversationId,
            graph_message_id: graphMessageId,
            subject,
            sender_name: fromName,
            sender_email: fromEmail,
            snippet,
            status: 'new',
            is_read: false,
            last_message_at: receivedAt,
          })
          .select('id')
          .single();
        if (ticketErr) continue;
        ticketId = newTicket.id;
      }

      await supabase.from('crm_ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'inbound',
        body: bodyHtml,
        body_preview: snippet,
        from_name: fromName,
        from_email: fromEmail,
        graph_message_id: graphMessageId,
        sent_at: receivedAt,
      });

      synced++;
    }

    return json({ connected: true, synced });
  } catch (e) {
    return json({ connected: true, synced: 0, error: String(e) }, 500);
  }
});
