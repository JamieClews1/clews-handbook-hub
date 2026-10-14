// Phase 2: prepares a reply draft for staff to review. It NEVER sends email —
// it only saves the draft on the ticket and returns it to the reply box.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiJson } from '../_shared/ai-responses.ts';

const WEIGHT_CHECKS_URL = 'https://portal.clewsrecycling.co.uk/weightchecks';
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const ukDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;

const Body = z.object({ ticketId: z.string().uuid(), templateKey: z.string().max(40).optional() });

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    template_key: { type: ['string', 'null'], description: 'Template used, or null if none fitted' },
    subject: { type: 'string' },
    body: { type: 'string', description: 'Plain-text reply ready to send' },
    missing: { type: 'array', items: { type: 'string' }, description: 'Facts the reply needs that were not available; written as short plain phrases' },
  },
  required: ['template_key', 'subject', 'body', 'missing'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: 'Unauthorized' }, 401);
    const { data: staff } = await admin.rpc('is_staff', { _user_id: u.user.id });
    if (!staff) return json({ error: 'Forbidden' }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'AI is not configured' }, 500);

    const { data: t } = await admin.from('crm_tickets').select('*').eq('id', parsed.data.ticketId).maybeSingle();
    if (!t) return json({ error: 'Ticket not found' }, 404);

    const { data: msgs } = await admin.from('crm_ticket_messages')
      .select('direction, from_name, body, body_preview, sent_at, is_internal_note')
      .eq('ticket_id', t.id).order('sent_at', { ascending: false }).limit(6);
    const thread = (msgs ?? []).reverse().map((m: any) =>
      `[${m.is_internal_note ? 'INTERNAL NOTE' : m.direction === 'inbound' ? 'CUSTOMER' : 'CLEWS'} ${m.from_name ?? ''} ${m.sent_at?.slice(0, 16)}]\n${stripHtml(m.body ?? m.body_preview ?? '').slice(0, 2500)}`,
    ).join('\n\n');

    const { data: templates } = await admin.from('crm_email_templates').select('template_key, name, subject, body').not('template_key', 'is', null);
    const ex = t.ai_extracted ?? {};
    const intent = parsed.data.templateKey ?? t.intent;

    // Facts from the portal — the AI may only use these, never invent prices or dates.
    const found: Record<string, string> = {};
    const { data: prof } = await admin.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle();
    found.userName = prof?.full_name ?? u.user.email ?? 'Clews Recycling';
    const { data: co } = await admin.from('company_profile').select('telephone, waste_carriers_licence_number, waste_carriers_licence_expiry').limit(1).maybeSingle();
    if (co?.telephone) found.companyPhone = co.telephone;
    if (co?.waste_carriers_licence_number) found.wclNumber = co.waste_carriers_licence_number;
    if (co?.waste_carriers_licence_expiry) found.wclExpiry = ukDate(co.waste_carriers_licence_expiry)!;
    found.weightChecksUrl = WEIGHT_CHECKS_URL;
    if (t.customer_id) {
      const { data: c } = await admin.from('customers').select('customer_name').eq('id', t.customer_id).maybeSingle();
      if (c?.customer_name) found.customer = c.customer_name;
    }
    const ref = ex.po_number || ex.job_reference;
    if (ref) {
      const { data: w } = await admin.rpc('lookup_job_weights', { pairs: [{ po: ref, postcode: ex.postcode ?? '' }] });
      const job = (w as any[] | null)?.[0];
      if (job) {
        found.jobNumber = job.job_number;
        if (job.job_date) found.jobDate = ukDate(job.job_date)!;
        if (job.weight_t != null) found.weightTonnes = Number(job.weight_t).toFixed(2);
        if (job.site) found.siteName = job.site;
        if (job.container_type) found.containerSize = job.container_type;
        if (job.waste_description) found.wasteType = job.waste_description;
      }
    }

    const draft = await aiJson(apiKey, {
      name: 'reply_draft',
      effort: 'medium',
      instructions: [
        'You draft email replies for Clews Recycling, a UK skip hire, RoRo and waste management company. A member of staff will review and edit your draft before sending.',
        'Pick the template that matches the latest customer request and fill its {{placeholders}}. Keep the template wording and tone: short, friendly, British English. Write plain text, no markdown.',
        'Use only facts from the email thread and the PORTAL FACTS. Never invent prices, dates, weights, availability or reference numbers.',
        'If a placeholder cannot be filled, write [square brackets describing what is needed] in the body and list it in "missing". Drop optional lines like {{poLine}} or {{weightLine}} cleanly when empty.',
        'firstName is the sender\'s first name if known, otherwise use "there". Sign off with userName.',
        'If no template fits, write a brief helpful reply in the same style and set template_key to null.',
      ].join('\n'),
      input: `TEMPLATES:\n${(templates ?? []).map((x: any) => `--- key=${x.template_key} (${x.name})\nSubject: ${x.subject}\n${x.body}`).join('\n\n')}\n\nSUGGESTED TEMPLATE: ${intent ?? 'none'}\n\nPORTAL FACTS:\n${JSON.stringify(found, null, 1)}\n\nEXTRACTED FROM EMAIL:\n${JSON.stringify(ex)}\n\nSENDER: ${t.sender_name ?? ''} <${t.sender_email ?? ''}>\nORIGINAL SUBJECT: ${t.subject ?? ''}\n\nTHREAD (oldest first):\n${thread}`,
      schema: SCHEMA,
    });
    if (!draft) return json({ error: 'AI returned no draft' }, 502);

    const patch = {
      ai_draft_subject: draft.subject, ai_draft_body: draft.body, ai_draft_template: draft.template_key,
      ai_draft_found: found, ai_draft_missing: draft.missing ?? [], ai_drafted_at: new Date().toISOString(),
      ai_draft_sent_at: null, ai_draft_edit_pct: null,
    };
    await admin.from('crm_tickets').update(patch).eq('id', t.id);
    return json({ ...draft, found });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
