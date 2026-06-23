import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ');

// Refreshes the user's access token if it is close to expiry. Returns a valid access token.
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
  if (!res.ok) {
    throw new Error(`Token refresh failed ${res.status}: ${await res.text()}`);
  }
  const tokens = await res.json();
  const accessToken = tokens.access_token;
  await admin
    .from('crm_mailbox_connections')
    .update({
      access_token: accessToken,
      refresh_token: tokens.refresh_token ?? conn.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id);
  return accessToken;
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: conn } = await admin
      .from('crm_mailbox_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!conn) {
      return json({ connected: false, synced: 0, message: 'No mailbox connected.' });
    }

    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(admin, conn);
    } catch (e) {
      return json({ connected: true, synced: 0, error: String(e), reauth: true }, 200);
    }

    const select =
      'id,conversationId,subject,from,bodyPreview,body,receivedDateTime,isRead';
    const url =
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=40&$orderby=receivedDateTime desc&$select=${select}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return json(
        { connected: true, synced: 0, error: `Graph error ${res.status}: ${await res.text()}` },
        200,
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

      // Skip messages already imported for this mailbox.
      const { data: existingMsg } = await admin
        .from('crm_ticket_messages')
        .select('id')
        .eq('graph_message_id', graphMessageId)
        .eq('mailbox_user_id', userId)
        .maybeSingle();
      if (existingMsg) continue;

      let ticketId: string | null = null;
      if (conversationId) {
        const { data: existingTicket } = await admin
          .from('crm_tickets')
          .select('id')
          .eq('graph_conversation_id', conversationId)
          .eq('mailbox_user_id', userId)
          .maybeSingle();
        ticketId = existingTicket?.id ?? null;
      }

      if (ticketId) {
        await admin
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
        const { data: newTicket, error: ticketErr } = await admin
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
            mailbox_user_id: userId,
          })
          .select('id')
          .single();
        if (ticketErr) continue;
        ticketId = newTicket.id;
      }

      await admin.from('crm_ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'inbound',
        body: bodyHtml,
        body_preview: snippet,
        from_name: fromName,
        from_email: fromEmail,
        graph_message_id: graphMessageId,
        sent_at: receivedAt,
        mailbox_user_id: userId,
      });

      synced++;
    }

    await admin
      .from('crm_mailbox_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId);

    return json({ connected: true, synced, email: conn.ms_email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
