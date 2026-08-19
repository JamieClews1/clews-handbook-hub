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

const WEIGHT_CHECKS_URL = 'https://portal.clewsrecycling.co.uk/weightchecks';

function isInternal(email: string): boolean {
  const e = email.toLowerCase();
  return (
    e.endsWith('@clewsrecycling.co.uk') ||
    e.includes('noreply') ||
    e.startsWith('postmaster@') ||
    e.startsWith('mailer-daemon@')
  );
}

// Builds the "taking bookings for" block from the live Route One booking windows.
async function bookingWindowsHtml(admin: any) {
  const { data } = await admin
    .from('route_one_booking_windows')
    .select('zone_label, roro_day, skip_day, note, sort_order')
    .order('sort_order');
  const rows: any[] = data ?? [];
  const vars: Record<string, string> = {};
  const line = (label: string, day: string) =>
    `<li style="margin:2px 0;">${label}: <strong>${day || 'TBC'}</strong></li>`;

  const roro = rows
    .map((r) => line(r.zone_label, r.roro_day))
    .join('');
  const skip = rows.map((r) => line(r.zone_label, r.skip_day)).join('');

  for (const r of rows) {
    const key = String(r.zone_label ?? '').replace(/[^0-9]/g, '');
    vars[`roroZone${key}`] = r.roro_day || 'TBC';
    vars[`skipZone${key}`] = r.skip_day || 'TBC';
  }
  const notes = rows
    .filter((r) => r.note)
    .map((r) => `<p style="margin:4px 0; color:#6b7280;">${r.zone_label}: ${r.note}</p>`)
    .join('');

  const html =
    `<p style="margin:6px 0;"><strong>RoRos:</strong></p><ul style="margin:0 0 10px 18px; padding:0;">${roro}</ul>` +
    `<p style="margin:6px 0;"><strong>Skips:</strong></p><ul style="margin:0 0 10px 18px; padding:0;">${skip}</ul>` +
    notes;

  return { html, vars };
}

// Sends the configurable holding reply via Graph. Returns the HTML sent, or null.
async function sendAutoReply(
  admin: any,
  accessToken: string,
  graphMessageId: string,
  subject: string,
  fromName: string,
): Promise<string | null> {
  const { data: template } = await admin
    .from('email_templates')
    .select('body_html, is_active')
    .eq('template_key', 'orders_auto_reply')
    .maybeSingle();
  if (!template?.body_html || template.is_active === false) return null;

  const { html: windows, vars } = await bookingWindowsHtml(admin);

  let body: string = template.body_html
    .replace(/\{\{bookingWindows\}\}/g, windows)
    .replace(/\{\{weightChecksUrl\}\}/g, WEIGHT_CHECKS_URL)
    .replace(/\{\{subject\}\}/g, subject ?? '')
    .replace(/\{\{senderName\}\}/g, fromName ?? '');
  for (const [k, v] of Object.entries(vars)) {
    body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  // Any remaining zone placeholders fall back to TBC.
  body = body.replace(/\{\{(roro|skip)Zone[0-9]*\}\}/g, 'TBC');

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${graphMessageId}/reply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: body }),
    },
  );
  if (!res.ok) {
    console.error('Graph auto-reply failed', res.status, await res.text());
    return null;
  }
  return body;
}

// Saves Outlook attachments for a message into storage + crm_ticket_attachments.
async function saveAttachments(
  admin: any,
  accessToken: string,
  graphMessageId: string,
  ticketId: string,
  messageRowId: string | null,
) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${graphMessageId}/attachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    console.error('Attachment fetch failed', res.status, await res.text());
    return;
  }
  const list: any[] = (await res.json()).value ?? [];
  for (const att of list) {
    if (att['@odata.type'] !== '#microsoft.graph.fileAttachment' || !att.contentBytes) continue;
    const bytes = Uint8Array.from(atob(att.contentBytes), (c) => c.charCodeAt(0));
    const safeName = String(att.name ?? 'attachment').replace(/[^\w.\- ]+/g, '_');
    const path = `${ticketId}/${att.id}-${safeName}`;
    const up = await admin.storage
      .from('crm-attachments')
      .upload(path, bytes, { contentType: att.contentType ?? 'application/octet-stream', upsert: true });
    if (up.error) {
      console.error('Attachment upload failed', up.error.message);
      continue;
    }
    await admin.from('crm_ticket_attachments').insert({
      ticket_id: ticketId,
      message_id: messageRowId,
      graph_attachment_id: att.id,
      file_name: att.name ?? safeName,
      content_type: att.contentType ?? null,
      size_bytes: att.size ?? null,
      storage_path: path,
    });
  }
}

// Syncs a single connected mailbox. Returns the number of new messages imported.
async function syncMailbox(admin: any, conn: any): Promise<{ synced: number; error?: string; reauth?: boolean }> {
  const userId = conn.user_id;
  let accessToken: string;
  try {
    accessToken = await ensureAccessToken(admin, conn);
  } catch (e) {
    return { synced: 0, error: String(e), reauth: true };
  }

  const select =
    'id,conversationId,subject,from,bodyPreview,body,receivedDateTime,isRead,hasAttachments';

  const url =
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=40&$orderby=receivedDateTime desc&$select=${select}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    return { synced: 0, error: `Graph error ${res.status}: ${await res.text()}` };
  }

  const data = await res.json();
  const messages: any[] = data.value ?? [];
  let synced = 0;

  const isOrdersInbox = (conn.ms_email ?? '').toLowerCase().startsWith('orders@');
  // Never auto-reply to historic mail pulled in on a first sync.
  const autoReplyCutoff = Date.now() - 2 * 60 * 60 * 1000;

  // Website enquiry exclusion settings (configurable in Admin Settings).
  const { data: autoRules } = await admin
    .from('crm_auto_reply_rules')
    .select('exclude_website_enquiries, exclude_patterns')
    .limit(1)
    .maybeSingle();
  const excludeWebsite = autoRules?.exclude_website_enquiries !== false;
  const excludePatterns: string[] = (autoRules?.exclude_patterns ?? [])
    .map((p: string) => (p ?? '').toLowerCase().trim())
    .filter(Boolean);

  const isWebsiteEnquiry = (email: string, subj: string, body: string) => {
    if (!excludeWebsite || excludePatterns.length === 0) return false;
    const hay = `${email} ${subj} ${body}`.toLowerCase();
    return excludePatterns.some((p) => hay.includes(p));
  };


  for (const m of messages) {
    const conversationId: string | null = m.conversationId ?? null;

    const graphMessageId: string = m.id;
    const subject: string = m.subject ?? '(no subject)';
    const fromName: string = m.from?.emailAddress?.name ?? '';
    const fromEmail: string = m.from?.emailAddress?.address ?? '';
    const snippet: string = m.bodyPreview ?? '';
    const bodyHtml: string = m.body?.content ?? snippet;
    const receivedAt: string = m.receivedDateTime ?? new Date().toISOString();

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
      // Link the thread to a customer account from the sender's address/domain.
      let customerId: string | null = null;
      if (fromEmail) {
        const { data: match } = await admin.rpc('crm_match_customer_by_email', {
          _email: fromEmail,
        });
        customerId = (match as string | null) ?? null;
      }
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
          customer_id: customerId,
        })
        .select('id')
        .single();
      if (ticketErr) continue;
      ticketId = newTicket.id;
    }

    const { data: insertedMsg } = await admin
      .from('crm_ticket_messages')
      .insert({
        ticket_id: ticketId,
        direction: 'inbound',
        body: bodyHtml,
        body_preview: snippet,
        from_name: fromName,
        from_email: fromEmail,
        graph_message_id: graphMessageId,
        sent_at: receivedAt,
        mailbox_user_id: userId,
      })
      .select('id')
      .maybeSingle();

    if (m.hasAttachments) {
      try {
        await saveAttachments(
          admin,
          accessToken,
          graphMessageId,
          ticketId!,
          insertedMsg?.id ?? null,
        );
      } catch (e) {
        console.error('Attachment sync failed', e);
      }
    }


    // Automatic holding reply for every newly imported external message in the
    // generic orders inbox, including follow-ups in an existing conversation.
    if (
      isOrdersInbox &&
      fromEmail &&
      !isInternal(fromEmail) &&
      !isWebsiteEnquiry(fromEmail, subject, bodyHtml ?? '') &&
      new Date(receivedAt).getTime() >= autoReplyCutoff
    ) {
      try {
        const sent = await sendAutoReply(admin, accessToken, graphMessageId, subject, fromName);
        if (sent) {
          await admin.from('crm_ticket_messages').insert({
            ticket_id: ticketId,
            direction: 'outbound',
            body: sent,
            body_preview: 'Automatic holding reply sent',
            from_name: 'Clews Recycling',
            from_email: conn.ms_email,
            sent_at: new Date().toISOString(),
            mailbox_user_id: userId,
          });
        }
      } catch (e) {
        console.error('Auto-reply failed', e);
      }
    }

    synced++;
  }

  await admin
    .from('crm_mailbox_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { synced };
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
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Scheduled mode: poll every connected mailbox (called by pg_cron).
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret && cronSecret === Deno.env.get('CRM_SYNC_CRON_SECRET')) {
      const { data: conns } = await admin.from('crm_mailbox_connections').select('*');
      const results: any[] = [];
      for (const c of conns ?? []) {
        const r = await syncMailbox(admin, c);
        results.push({ email: c.ms_email, ...r });
      }
      return json({ cron: true, mailboxes: results });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data: conn } = await admin
      .from('crm_mailbox_connections')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!conn) {
      return json({ connected: false, synced: 0, message: 'No mailbox connected.' });
    }

    const result = await syncMailbox(admin, conn);
    return json({ connected: true, email: conn.ms_email, ...result });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
