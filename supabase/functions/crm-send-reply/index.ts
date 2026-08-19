import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/microsoft_outlook';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ');

function newReplyMessage(ticket: any, replyHtml: string) {
  return {
    message: {
      subject: /^re:/i.test(ticket.subject ?? '') ? ticket.subject : `Re: ${ticket.subject ?? ''}`,
      body: { contentType: 'HTML', content: replyHtml },
      toRecipients: [{ emailAddress: { address: ticket.sender_email } }],
    },
    saveToSentItems: true,
  };
}

async function ensureAccessToken(admin: any, conn: any): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  const clientId = Deno.env.get('MS_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MS_CLIENT_SECRET')!;
  const tenant = Deno.env.get('MS_TENANT_ID') || 'organizations';

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
        scope: SCOPES,
      }),
    },
  );
  if (!res.ok) throw new Error(`Token refresh failed ${res.status}`);
  const tokens = await res.json();
  await admin
    .from('crm_mailbox_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? conn.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id);
  return tokens.access_token;
}

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
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const ticketId: string | undefined = body?.ticketId;
    const replyHtml: string | undefined = body?.body;
    if (!ticketId || !replyHtml || typeof replyHtml !== 'string' || replyHtml.length > 100_000) {
      return json({ error: 'ticketId and body are required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: ticket, error: ticketErr } = await supabase
      .from('crm_tickets')
      .select('id, graph_message_id, sender_email, sender_name, subject, mailbox_user_id')
      .eq('id', ticketId)
      .single();
    if (ticketErr || !ticket) return json({ error: 'Ticket not found' }, 404);

    const { data: latestInbound } = await supabase
      .from('crm_ticket_messages')
      .select('graph_message_id')
      .eq('ticket_id', ticketId)
      .eq('direction', 'inbound')
      .not('graph_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const replyMessageId = latestInbound?.graph_message_id ?? ticket.graph_message_id;

    let graphSent = false;
    let graphError: string | null = null;
    let fromEmail = 'orders@clewsrecycling.co.uk';

    // Prefer sending from the logged-in user's own connected mailbox.
    const { data: conn } = await supabase
      .from('crm_mailbox_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (conn) {
      try {
        const accessToken = await ensureAccessToken(supabase, conn);
        fromEmail = conn.ms_email;
        const canReplyInThread = conn.user_id === ticket.mailbox_user_id && replyMessageId;
        const graphUrl = canReplyInThread
          ? `https://graph.microsoft.com/v1.0/me/messages/${replyMessageId}/reply`
          : 'https://graph.microsoft.com/v1.0/me/sendMail';
        const graphBody = canReplyInThread
          ? { message: { body: { contentType: 'HTML', content: replyHtml } } }
          : newReplyMessage(ticket, replyHtml);
        let res = await fetch(graphUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(graphBody),
        });

        // Graph message IDs are mailbox-specific and can become stale after a
        // move/delete. If the threaded reply target is unavailable, send a new
        // Re: message from the same mailbox instead of failing the CRM reply.
        if (!res.ok && canReplyInThread && res.status === 404) {
          res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newReplyMessage(ticket, replyHtml)),
          });
        }
        if (res.ok) {
          graphSent = true;
        } else {
          graphError = `Graph error ${res.status}: ${await res.text()}`;
        }
      } catch (e) {
        graphError = String(e);
      }
    } else {
      // Fallback: shared orders@ mailbox via the Lovable connector.
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const connectionKey = Deno.env.get('MICROSOFT_OUTLOOK_API_KEY');
      if (lovableKey && connectionKey && replyMessageId) {
        let res = await fetch(
          `${GATEWAY_URL}/me/messages/${replyMessageId}/reply`,
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

        if (!res.ok && res.status === 404) {
          res = await fetch(`${GATEWAY_URL}/me/sendMail`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              'X-Connection-Api-Key': connectionKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newReplyMessage(ticket, replyHtml)),
          });
        }
        if (res.ok) {
          graphSent = true;
        } else {
          graphError = `Graph error ${res.status}: ${await res.text()}`;
        }
      } else {
        graphError = 'No mailbox connected — reply saved to the conversation only.';
      }
    }

    if (!graphSent) {
      return json({ error: graphError ?? 'The reply could not be sent.' }, 502);
    }

    // Record only successfully sent messages so the conversation remains accurate.
    await supabase.from('crm_ticket_messages').insert({
      ticket_id: ticketId,
      direction: 'outbound',
      body: replyHtml,
      body_preview: replyHtml.replace(/<[^>]+>/g, '').slice(0, 200),
      from_email: fromEmail,
      sent_at: new Date().toISOString(),
      mailbox_user_id: ticket.mailbox_user_id ?? userId,
    });

    await supabase
      .from('crm_tickets')
      .update({ status: 'pending', last_message_at: new Date().toISOString() })
      .eq('id', ticketId);

    return json({ sent: graphSent, error: graphError, from: fromEmail });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
