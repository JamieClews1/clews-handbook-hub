// Phase 1 CRM triage: files noise, links senders to customers, sets intent,
// category and priority. It NEVER sends email — it only updates ticket fields.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const INTENTS = [
  'booking', 'quote', 'exchange', 'collection', 'weight_paperwork', 'invoice',
  'cancellation', 'compliance', 'job_check', 'complaint', 'thank_you',
  'other', 'noise_spam', 'noise_system', 'noise_newsletter', 'internal',
] as const;

const CATEGORY: Record<string, string | null> = {
  booking: 'Booking', exchange: 'Booking', collection: 'Booking', cancellation: 'Booking',
  job_check: 'Booking', quote: 'Query', weight_paperwork: 'Query', compliance: 'Query',
  invoice: 'Invoice', complaint: 'Complaint', other: 'Other',
};

// Rule-based noise filters run before AI so obvious mail costs nothing.
function ruleIntent(email: string, subject: string): string | null {
  const e = email.toLowerCase(); const s = subject.toLowerCase();
  if (/quarantine|spam report|ps4b/.test(s) || /quarantine/.test(e)) return 'noise_spam';
  if (/(noreply|no-reply|donotreply|mailer-daemon|postmaster|notifications?@)/.test(e)) return 'noise_system';
  if (/(resend\.|lovable\.|quickconsign)/.test(e)) return 'noise_system';
  if (/^(automatic reply|out of office|undeliverable|delivery status|read:|reacted to)/.test(s)) return 'thank_you';
  if (/unsubscribe|newsletter|webinar/.test(s)) return 'noise_newsletter';
  return null;
}

const URGENT_RE = /\b(urgent|asap|contaminat|missed|not emptied|not been emptied|dispute|on stop|complain)/i;
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const nullableStr = { type: ['string', 'null'] };
const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: INTENTS },
    urgent: { type: 'boolean', description: 'Contamination, missed/not emptied lift, urgent/ASAP, dispute, account on stop' },
    summary: { type: 'string', description: 'One short sentence' },
    company_name: { ...nullableStr, description: 'Customer company the email is on behalf of (broker or end customer)' },
    po_number: nullableStr, contract_number: nullableStr, job_reference: nullableStr,
    site_name: nullableStr, postcode: nullableStr, container: nullableStr, waste_type: nullableStr,
    service: { ...nullableStr, description: 'deliver, exchange or collect' },
    requested_date: nullableStr,
    suggested_assignee: { ...nullableStr, description: 'Name of the team member best placed to handle this, chosen from the TEAM list, or null' },
  },
  required: ['intent', 'urgent', 'summary', 'company_name', 'po_number', 'contract_number', 'job_reference',
    'site_name', 'postcode', 'container', 'waste_type', 'service', 'requested_date', 'suggested_assignee'],
};

async function aiClassify(apiKey: string, subject: string, from: string, body: string, team: string[]) {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Lovable-API-Key': apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
      instructions: 'You triage emails arriving at Clews Recycling, a UK skip hire, RoRo and waste management company. Brokers (Reconomy, Go Green, Biffa, Kenny, LB Waste, Opteco, Project Waste, YardLink, SPUD Now, MJ Church, Acorn) send purchase orders. Classify the email and extract fields. Use null when a field is not present.',
      input: `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 4000)}`,
      text: { format: { type: 'json_schema', name: 'triage', strict: true, schema: TRIAGE_SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI ${res.status}: ${await res.text()}`);
  // Consume the SSE stream and collect the output text.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '', done = '';
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === 'response.output_text.delta') out += ev.delta ?? '';
        else if (ev.type === 'response.output_text.done') done = ev.text ?? '';
        else if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(JSON.stringify(ev));
      } catch (e) { if (e instanceof Error && e.message.startsWith('{')) throw e; }
    }
  }
  const text = done || out;
  return text ? JSON.parse(text) : null;
}

async function linkCustomer(admin: any, email: string, ex: any): Promise<{ id: string | null; conf: number | null }> {
  if (email) {
    const { data } = await admin.rpc('crm_match_customer_by_email', { _email: email });
    if (data) return { id: data as string, conf: 0.95 };
  }
  const name: string | null = ex?.company_name ?? null;
  if (name && name.length >= 3) {
    const { data } = await admin.from('customers').select('id').ilike('customer_name', `%${name.replace(/[%_,()]/g, ' ').trim()}%`).limit(2);
    if (data?.length === 1) return { id: data[0].id, conf: 0.85 };
    if (data?.length > 1) return { id: data[0].id, conf: 0.6 };
  }
  if (ex?.postcode) {
    const pc = String(ex.postcode).toUpperCase().replace(/\s+/g, '');
    const { data } = await admin.from('customer_sites').select('customer_id, postcode').limit(50).ilike('postcode', `%${pc.slice(0, -3)}%`);
    const hits = (data ?? []).filter((s: any) => (s.postcode ?? '').toUpperCase().replace(/\s+/g, '') === pc);
    const ids = [...new Set(hits.map((h: any) => h.customer_id))];
    if (ids.length === 1) return { id: ids[0] as string, conf: 0.8 };
  }
  return { id: null, conf: null };
}

const Body = z.object({ ticket_ids: z.array(z.string().uuid()).max(100).optional() });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    // Allow the sync function (service key) or a signed-in staff member.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (token !== serviceKey) {
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: staff } = await admin.rpc('is_staff', { _user_id: u.user.id });
      if (!staff) return json({ error: 'Forbidden' }, 403);
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const { data: settings } = await admin.from('crm_ai_settings').select('triage_enabled').maybeSingle();
    if (settings && settings.triage_enabled === false) return json({ triaged: 0, disabled: true });

    let q = admin.from('crm_tickets').select('id, subject, sender_email, sender_name, customer_id, priority, category').is('ai_triaged_at', null);
    q = parsed.data.ticket_ids?.length ? q.in('id', parsed.data.ticket_ids) : q.limit(25);
    const { data: tickets } = await q;
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    let triaged = 0;

    for (const t of tickets ?? []) {
      const { data: msg } = await admin.from('crm_ticket_messages').select('body, body_preview')
        .eq('ticket_id', t.id).eq('direction', 'inbound').order('sent_at', { ascending: false }).limit(1).maybeSingle();
      const body = stripHtml(msg?.body ?? msg?.body_preview ?? '');
      let intent = ruleIntent(t.sender_email ?? '', t.subject ?? '');
      let ex: any = null;
      if (!intent && apiKey) {
        try { ex = await aiClassify(apiKey, t.subject ?? '', `${t.sender_name ?? ''} <${t.sender_email ?? ''}>`, body); intent = ex?.intent ?? null; }
        catch (e) { console.error('AI triage failed', t.id, e); continue; }
      }
      intent = intent ?? 'other';
      const filed = intent.startsWith('noise_') || intent === 'internal';
      const urgent = !filed && (ex?.urgent === true || URGENT_RE.test(`${t.subject} ${body.slice(0, 1500)}`));

      const patch: Record<string, unknown> = {
        intent, is_filed: filed, ai_triaged_at: new Date().toISOString(),
        ai_summary: ex?.summary ?? null, ai_extracted: ex,
      };
      if (!t.category && CATEGORY[intent]) patch.category = CATEGORY[intent];
      if (urgent && (!t.priority || t.priority === 'normal' || t.priority === 'low')) patch.priority = 'high';
      if (filed || intent === 'thank_you') patch.status = 'resolved';
      if (!t.customer_id && !filed) {
        const link = await linkCustomer(admin, t.sender_email ?? '', ex);
        if (link.id) { patch.customer_id = link.id; patch.ai_link_confidence = link.conf; }
      }
      await admin.from('crm_tickets').update(patch).eq('id', t.id);
      triaged++;
    }
    return json({ triaged });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
