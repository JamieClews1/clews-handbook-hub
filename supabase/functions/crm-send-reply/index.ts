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
    // Authenticate the calling staff user.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const ticketId: string | undefined = body?.ticketId;
    const replyHtml: string | undefined = body?.body;
    if (!ticketId || !replyHtml || typeof replyHtml !== 'string') {
      return json({ error: 'ticketId and body are required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: ticket, error: ticketErr } = await supabase
      .from('crm_tickets')
      .select('id, graph_message_id, sender_email, sender_name, subject')
      .eq('id', ticketId)
      .single();
    if (ticketErr || !ticket) return json({ error: 'Ticket not found' }, 404);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionKey = Deno.env.get('MICROSOFT_OUTLOOK_API_KEY');

    let graphSent = false;
    let graphError: string | null = null;

    if (lovableKey && connectionKey && ticket.graph_message_id) {
      // Reply on the original conversation so threading + Sent items work.
      const res = await fetch(
        `${GATEWAY_URL}/me/messages/${ticket.graph_message_id}/reply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': connectionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: { body: { contentType: 'HTML', content: replyHtml } },
          }),
        },
      );
      if (res.ok) {
        graphSent = true;
      } else {
        graphError = `Graph error ${res.status}: ${await res.text()}`;
      }
    } else {
      graphError = 'Outlook mailbox not connected — reply saved as draft only.';
    }

    // Record the outbound message regardless, so the conversation stays complete.
    await supabase.from('crm_ticket_messages').insert({
      ticket_id: ticketId,
      direction: 'outbound',
      body: replyHtml,
      body_preview: replyHtml.replace(/<[^>]+>/g, '').slice(0, 200),
      from_email: 'orders@clewsrecycling.co.uk',
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from('crm_tickets')
      .update({ status: 'pending', last_message_at: new Date().toISOString() })
      .eq('id', ticketId);

    return json({ sent: graphSent, error: graphError });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
