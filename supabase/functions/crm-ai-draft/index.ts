// Phase 2: prepares a reply draft for staff to review. It NEVER sends email —
// it only saves the draft on the ticket and returns it to the reply box.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiJson } from '../_shared/ai-responses.ts';
import { matchMatrixPostcode, MATRIX_ZONE_TO_CODE } from '../_shared/matrix-postcode-zone.ts';

const WEIGHT_CHECKS_URL = 'https://portal.clewsrecycling.co.uk/weightchecks';
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const ukDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
const PERSONAL_DOMAINS = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|btinternet|btopenworld|sky|talktalk|virginmedia|ntlworld|blueyonder|tiscali|plusnet|protonmail|proton|gmx|mail)\./;
const DAYS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const LOW_STOCK = 2;
const RORO_RE = /ro\s*-?\s*ro|roll[- ]?on|\b(20|25|30|35|40)\s*-?\s*(yd|yds|yrd|yard)/i;
/** Next date for a booking-board day code (today counts), e.g. "Monday 19 October". */
function bookingDate(day: string | null | undefined): string | null {
  const target = DAYS[String(day ?? '').trim().toUpperCase()];
  if (target === undefined) return null;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  now.setDate(now.getDate() + ((target - now.getDay() + 7) % 7));
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

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
    const thread = [...(msgs ?? [])].reverse().map((m: any) =>
      `[${m.is_internal_note ? 'INTERNAL NOTE' : m.direction === 'inbound' ? 'CUSTOMER' : 'CLEWS'} ${m.from_name ?? ''} ${m.sent_at?.slice(0, 16)}]\n${stripHtml(m.body ?? m.body_preview ?? '').slice(0, 2500)}`,
    ).join('\n\n');

    const { data: templates } = await admin.from('crm_email_templates').select('template_key, name, subject, body').not('template_key', 'is', null);
    const ex: Record<string, any> = { ...(t.ai_extracted ?? {}) };
    // Emails that skipped auto-sorting (e.g. internal) have no extracted details: read them from the customer's own messages.
    const inboundText = (msgs ?? []).filter((m: any) => m.direction === 'inbound' && !m.is_internal_note)
      .map((m: any) => stripHtml(m.body ?? m.body_preview ?? '').split(/\bOn [^\n]{5,120}? wrote:|-----Original Message-----|\bFrom: [^\n]{3,80}Sent:/i)[0]).join(' ');
    if (!ex.postcode) ex.postcode = inboundText.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0]?.toUpperCase() ?? null;
    if (!ex.container) {
      const c = inboundText.match(/\b\d{1,2}\s*-?\s*(?:yd|yds|yrd|yard|yards|yarder|cubic yard)s?\b(?:\s*(?:skip|ro\s*-?ro|roll[- ]on))?/i)?.[0];
      ex.container = c ?? (/ro\s*-?ro/i.test(inboundText) ? 'RoRo' : null);
    }
    if (!ex.waste_type) ex.waste_type = inboundText.match(/\b(mixed waste|general waste|general|plasterboard|wood|green waste|garden waste|hardcore|inert|rubble|soil|concrete|mixed)\b/i)?.[0] ?? null;
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

    // Site history: what this customer has on site, so exchanges/collections can name the containers and postcode.
    try {
      const stems = [found.customer, ex.company_name, ex.customer_name].filter(Boolean).map((s: string) => s.split(/\s+/)[0]);
      const dom = String(t.sender_email ?? '').split('@')[1]?.split('.')[0] ?? '';
      if (dom && !PERSONAL_DOMAINS.test(`${dom}.`) && dom.length >= 3) stems.push(dom);
      const stem = stems.find((s) => s && s.length >= 3)?.replace(/[%,()]/g, '');
      if (stem) {
        const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        const { data: jobs } = await admin.from('data_hub_jobs')
          .select('job_date, site, container_type, movement_type, waste_description, postcode')
          .ilike('customer', `%${stem}%`).gte('job_date', since).order('job_date', { ascending: false }).limit(1000);
        const moves = (jobs ?? []).filter((j: any) => /exchange|deliver|collect|tip/i.test(j.movement_type ?? '') && j.site);
        if (moves.length) {
          const text = `${ex.site_name ?? ''} ${ex.address ?? ''} ${inboundText} ${t.subject ?? ''}`.toLowerCase();
          const bySite = new Map<string, any[]>();
          for (const j of moves) bySite.set(j.site, [...(bySite.get(j.site) ?? []), j]);
          const sites = [...bySite.keys()];
          const site = sites.find((s) => s.toLowerCase().split(/\W+/).some((w) => w.length >= 4 && !/^(ltd|limited|site|recycling)$/.test(w) && text.includes(w)))
            ?? (sites.length === 1 ? sites[0] : null);
          if (site) {
            const sj = bySite.get(site)!;
            const today = new Date().toISOString().slice(0, 10);
            // Count = most of one container/waste moved on a single day (e.g. 2 exchanged together = 2 on site).
            const groups = new Map<string, { perDay: Map<string, number>; last: string }>();
            for (const j of sj) {
              const k = `${j.container_type} — ${j.waste_description ?? 'waste'}`;
              const g = groups.get(k) ?? { perDay: new Map(), last: '' };
              g.perDay.set(j.job_date, (g.perDay.get(j.job_date) ?? 0) + 1);
              if (j.job_date <= today && j.job_date > g.last) g.last = j.job_date;
              groups.set(k, g);
            }
            const lines = [...groups.entries()].map(([k, g]) => `${Math.max(...g.perDay.values())} × ${k}${g.last ? ` (last serviced ${ukDate(g.last)})` : ''}`);
            const booked = sj.filter((j: any) => j.job_date > today).map((j: any) => `${ukDate(j.job_date)} ${j.movement_type} ${j.container_type}`);
            found.siteName = site;
            found.onSite = lines.join('; ');
            if (booked.length) found.alreadyBooked = booked.slice(0, 5).join('; ');
            const pc = sj.find((j: any) => j.postcode)?.postcode;
            if (pc) { found.sitePostcode = pc; ex.postcode = pc; } // site postcode beats a signature postcode
            if (!ex.container) ex.container = [...groups.keys()].map((k) => k.split(' — ')[0]).join('; ');
          }
        }
      }
    } catch (e) { console.error('site history failed', e); }

    // Customer type: no linked customer + personal email domain => residential.
    const domain = String(t.sender_email ?? '').split('@')[1]?.toLowerCase() ?? '';
    const addr = `${ex.site_name ?? ''} ${ex.address ?? ''}`;
    const businessAddr = /\b(ltd|limited|plc|llp|unit|industrial|estate|business|trading|depot|works|warehouse|park|centre|center|site)\b/i.test(addr);
    const isResidential = !t.customer_id && !ex.company_name && !ex.contract_number && (PERSONAL_DOMAINS.test(domain) || (addr.trim() !== '' && !businessAddr));
    found.customerType = isResidential ? 'Residential (personal email, no company account)' : 'Trade';

    // Zone from the pricing matrix only (same matcher as the Pricing section).
    const containerText = `${ex.container ?? ''} ${found.containerSize ?? ''}`;
    const wasteText = `${ex.waste_type ?? ''} ${found.wasteType ?? ''}`.toLowerCase();
    const isRoRo = RORO_RE.test(containerText);
    let zoneLabel: string | null = null;
    if (ex.postcode) {
      const { data: rows } = await admin.from('pricing_zone_postcodes').select('postcode_prefix, zone_code, area');
      const m = matchMatrixPostcode(String(ex.postcode), (rows ?? []) as any);
      if (m.status === 'matched') { zoneLabel = m.zone; found.zone = m.zone; }
      else found.zone = m.status === 'ambiguous' ? 'postcode sector split between zones — staff to confirm zone' : 'postcode not on pricing matrix — staff to confirm';
    }

    // Price from the Pricing section's rate cards.
    const prices: string[] = [];
    for (const part of containerText.split(/;|\band\b|,/).map((x) => x.trim()).filter((x) => /\d|skip|ro\s*-?ro/i.test(x))) {
      if (!zoneLabel) break;
      const isRoRo = RORO_RE.test(part);
      const containerText = part;
      const zoneCode = MATRIX_ZONE_TO_CODE[zoneLabel];
      // The residential card has skips only — RoRos are always priced from the Trade card.
      const useResidential = isResidential && !isRoRo;
      const cardName = useResidential ? 'Residential Skip Rates 2026' : 'Trade Rates 2026';
      const { data: card } = await admin.from('pricing_rate_cards').select('id, name, vat_inclusive').eq('name', cardName).eq('is_active', true).maybeSingle();
      if (card && zoneCode) {
        const { data: rows } = await admin.from('pricing_rate_card_rows').select('id, section, label').eq('card_id', card.id);
        const { data: zones } = await admin.from('pricing_rate_card_zones').select('id, zone_code').eq('card_id', card.id);
        const cat = !wasteText.trim() ? 'general' : /plaster/.test(wasteText) ? 'plaster' : /wood/.test(wasteText) ? 'wood' : /green|garden/.test(wasteText) ? 'green'
          : /inert|hardcore|rubble|soil|concrete|brick/.test(wasteText) ? 'inert' : 'general';
        const sectionRe: Record<string, RegExp> = useResidential
          ? { plaster: /mixed/i, wood: /wood/i, green: /green/i, inert: /inert|hardcore/i, general: /mixed waste/i }
          : isRoRo
            ? { plaster: /roro.*general/i, wood: /roro.*general/i, green: /roro.*general/i, inert: /roro.*inert/i, general: /roro.*general/i }
            : { plaster: /plasterboard/i, wood: /wood/i, green: /wood|green/i, inert: /inert/i, general: /skip hire.*general/i };
        const size = containerText.match(/(\d+)\s*-?\s*(yd|yrd|yard|cubic)/i)?.[1];
        const enclosed = /enclosed|lockable|lid/i.test(containerText);
        const cands = (rows ?? []).filter((r: any) => sectionRe[cat].test(useResidential ? r.label : r.section) && !/haulage/i.test(r.section))
          .filter((r: any) => !size || isRoRo || new RegExp(`\\b${size}\\b`).test(r.label))
          .sort((a: any, b: any) => Number(/enclosed/i.test(a.label) !== enclosed) - Number(/enclosed/i.test(b.label) !== enclosed));
        const row = cands[0];
        const zone = (zones ?? []).find((z: any) => z.zone_code === zoneCode);
        if (row && zone) {
          const { data: v } = await admin.from('pricing_rate_card_values').select('status, price, included_tonnes').eq('row_id', row.id).eq('zone_id', zone.id).maybeSingle();
          if (v?.status === 'price' && v.price != null) {
            prices.push(`£${Number(v.price).toFixed(2)} ${card.vat_inclusive ? 'inc VAT' : '+ VAT'} (${row.label}, ${zoneLabel}, ${card.name})`);
            if (isRoRo && (Number(v.included_tonnes) > 0 || /inc\s*2\s*\/\s*inc\s*3/i.test(row.label))) {
              const inc = Number(v.included_tonnes) > 0 ? Number(v.included_tonnes) : /roro/i.test(zoneLabel) ? 3 : /zone\s*1\b/i.test(zoneLabel) ? 1 : /zone\s*2\b/i.test(zoneLabel) ? 2 : 3;
              const gw = (rows ?? []).find((r: any) => /tonnage/i.test(r.section) && (cat === 'inert' ? /mixed inert|hardcore/i : cat === 'plaster' ? /plasterboard/i : /^general waste$/i).test(String(r.label).trim()));
              let rate = '';
              if (gw) {
                const { data: gv } = await admin.from('pricing_rate_card_values').select('price').eq('row_id', gw.id).not('price', 'is', null).limit(1).maybeSingle();
                if (gv?.price != null) rate = `£${Number(gv.price).toFixed(2)} per tonne + VAT`;
              }
              found.tonnage = `RoRo price INCLUDES the first ${inc === 1 ? 'tonne' : `${inc} tonnes`}. Each tonne over ${inc}t is charged at ${rate || '[general waste per-tonne rate]'}. State this clearly on its own line in the reply.`;
            }
          } else if (v) prices.push(`Call for quote (${row.label}, ${zoneLabel})`);
        }
      }
    }
    if (prices.length) found.price = prices.join(' | ');
    if (zoneLabel) {
      const fsZone = /zone\s*1/i.test(zoneLabel) ? 'Zone 1' : /zone\s*2/i.test(zoneLabel) ? 'Zone 2' : 'Zone 3';
      const { data: fs } = await admin.from('fuel_surcharge_rates').select('surcharge_amount')
        .eq('zone', fsZone).eq('vehicle_category', isRoRo ? 'RoRo' : 'Skips').eq('active', true).is('customer_match', null)
        .order('effective_from_date', { ascending: false }).limit(1).maybeSingle();
      if (fs?.surcharge_amount != null) found.fuelSurcharge = `£${Number(fs.surcharge_amount).toFixed(2)} + VAT per movement (${fsZone})`;

      // Earliest delivery from Route One's "Taking bookings for" board.
      const { data: wins } = await admin.from('route_one_booking_windows').select('zone_label, skip_day, roro_day');
      const n = zoneLabel.match(/zone\s*(\d)/i)?.[1];
      // RoRo-only / outer zones without their own row use the furthest zone's board day.
      const win = (wins ?? []).find((w: any) => n && new RegExp(`\\b${n}\\b`).test(w.zone_label))
        ?? (/roro/i.test(zoneLabel) ? [...(wins ?? [])].sort((a: any, b: any) => String(b.zone_label).localeCompare(String(a.zone_label)))[0] : undefined);
      const day = win ? (isRoRo ? win.roro_day : win.skip_day) : null;
      const date = bookingDate(day);
      if (date) found.availableDate = date;
      else if (day) found.availableDate = 'to be confirmed';
    }

    // Stock: same "Bookings Allowed" sum as Stock Check (last yard tally, adjusted by
    // completed movements since, plus outstanding collections minus deliveries for 5 days, minus runners).
    let stock: { type: string; available: number; tallyDate: string; low: boolean } | null = null;
    try {
      const size = containerText.match(/(\d+)\s*-?\s*(yd|yds|yrd|yard|cubic)/i)?.[1];
      if (size) {
        const { data: types } = await admin.from('stock_check_container_types').select('id, name, category, data_hub_keywords').eq('is_active', true);
        const enclosed = /enclosed|lockable|lid/i.test(containerText);
        const cat = isRoRo ? 'roro' : 'skip';
        const type = (types ?? [])
          .filter((x: any) => x.category === cat && new RegExp(`(^|\\D)${size}(\\D|$)`).test(x.name) && !/compactor|walk|asbestos/i.test(x.name))
          .sort((a: any, b: any) => Number(/enclosed/i.test(a.name) !== enclosed) - Number(/enclosed/i.test(b.name) !== enclosed))[0];
        const { data: check } = await admin.from('stock_checks').select('id, check_date').eq('status', 'submitted').order('check_date', { ascending: false }).limit(1).maybeSingle();
        if (type && check) {
          const { data: item } = await admin.from('stock_check_items').select('in_yard, runner').eq('stock_check_id', check.id).eq('container_type_id', type.id).maybeSingle();
          if (item) {
            const { data: excl } = await admin.from('stock_check_excluded_sites').select('site_name');
            const ex2 = (excl ?? []).map((e: any) => String(e.site_name).toLowerCase());
            const today = new Date().toISOString().slice(0, 10);
            const end = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
            const kws: string[] = type.data_hub_keywords ?? [];
            const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const bestType = (ct: string) => {
              let best: any = null, len = 0;
              for (const ty of types ?? []) for (const kw of ty.data_hub_keywords ?? []) {
                if (kw.length > len && new RegExp(`(^|\\W)${esc(kw)}(\\W|$)`, 'i').test(ct)) { len = kw.length; best = ty; }
              }
              return best;
            };
            const count = (jobs: any[], skipDone: boolean) => {
              let n = 0;
              for (const j of jobs) {
                if (!j.container_type || ex2.some((x) => String(j.site ?? '').toLowerCase().includes(x))) continue;
                if (skipDone && j.raw?.Status === 'Y') continue;
                if (bestType(j.container_type)?.id !== type.id) continue;
                const mt = String(j.movement_type ?? '').toLowerCase();
                if (mt.includes('exchange')) continue;
                if (mt.includes('collect')) n++; else if (mt.includes('deliver')) n--;
              }
              return n;
            };
            let adj = 0;
            if (check.check_date < today) {
              const { data: past } = await admin.from('data_hub_jobs').select('container_type, movement_type, site, raw')
                .eq('source', 'skiptrak').gt('job_date', check.check_date).lt('job_date', today).limit(5000);
              adj = count(past ?? [], false);
            }
            const { data: next } = await admin.from('data_hub_jobs').select('container_type, movement_type, site, raw')
              .eq('source', 'skiptrak').gte('job_date', today).lte('job_date', end).limit(5000);
            const available = item.in_yard + adj + count(next ?? [], true) - item.runner;
            stock = { type: type.name, available, tallyDate: check.check_date, low: available <= LOW_STOCK };
            found.stock = available <= 0
              ? `No ${type.name} available to book in the next 5 days — do NOT promise a date; say staff will confirm availability.`
              : `${available} × ${type.name} available to book${available <= LOW_STOCK ? ' (low stock)' : ''}.`;
          }
        }
      }
    } catch (e) { console.error('stock check failed', e); }

    // Permit: only state it if the customer said it goes on the road; otherwise ask.
    const allText = inboundText.toLowerCase();
    const isServiceOnSite = /exchange|collect/i.test(String(intent ?? '')) || (!!found.onSite && /exchange|swap|empty|collect|full/i.test(allText));
    if (isServiceOnSite) found.jobType = 'Service on containers already on site — state the date as booked, no permit question, no new-delivery pricing.';
    if (isServiceOnSite) { delete found.stock; delete found.price; delete found.tonnage; stock = null; }
    found.permitNote = isServiceOnSite ? 'Not needed — containers already on site.' : /permit/.test(allText)
      ? 'Customer mentioned a permit — confirm the council permit cost/lead time.'
      : 'ASK: Will the skip be placed on your driveway/private land, or on the road? If on the road, a council permit is needed.';

    // Persona: the assignee's own voice, else the drafting user's, else the generic team voice.
    // Personas shape tone only — facts still come from PORTAL FACTS.
    let persona: { name: string; persona: string } | null = null;
    const memberIds: string[] = [];
    if (t.assigned_to) memberIds.push(t.assigned_to);
    const { data: me } = await admin.from('crm_team_members').select('id')
      .or(`user_id.eq.${u.user.id},personal_email.ilike.${u.user.email ?? '-'}`).eq('is_active', true).limit(1).maybeSingle();
    if (me?.id) memberIds.push(me.id);
    for (const id of memberIds) {
      const { data: p } = await admin.from('crm_ai_personas').select('name, persona').eq('team_member_id', id).eq('is_active', true).maybeSingle();
      if (p) { persona = p; break; }
    }
    if (!persona) {
      const { data: p } = await admin.from('crm_ai_personas').select('name, persona').eq('is_default', true).eq('is_active', true).maybeSingle();
      persona = p ?? null;
    }
    const ukHour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }));

    const draft = await aiJson(apiKey, {
      name: 'reply_draft',
      effort: 'medium',
      instructions: [
        'You draft email replies for Clews Recycling, a UK skip hire, RoRo and waste management company. A member of staff will review and edit your draft before sending.',
        persona
          ? 'Pick the template that matches the latest customer request and use it for what must be covered and its {{placeholders}}, but WRITE IN THE PERSONA\'S VOICE below (greeting, sign-off, line style, length, phrases). Plain text, no markdown, British English.'
          : 'Pick the template that matches the latest customer request and fill its {{placeholders}}. Keep the template wording and tone: short, friendly, British English. Write plain text, no markdown.',
        'If PORTAL FACTS stock says none available, do not offer the earliest delivery date; say we will confirm availability. Never mention stock counts to the customer.',
        'If the latest customer message is only a thank-you or acknowledgement, reply to the most recent request in the thread that we have not yet answered.',
        'Be definite, not tentative: when PORTAL FACTS has availableDate, state it as fact (e.g. "We will do the exchange on Monday 26 October." / "Booked on for Monday as requested."). Never write "we will confirm a date" when a date is available. availableDate is the next day we are taking bookings for, so it applies to exchanges and collections too.',
        'When PORTAL FACTS has onSite, name the containers from it (e.g. "both 40YD RoRos (plastics) at Munster Joinery") instead of asking the customer what they have. Only say something is already booked if PORTAL FACTS alreadyBooked lists it; never invent dates.',
        'Use only facts from the email thread and the PORTAL FACTS. Never invent prices, dates, weights, availability or reference numbers. The persona examples are for style only — never copy numbers from them.',
        'If a placeholder or fact cannot be filled, write [CHECK: what is needed] in the body and list it in "missing". Drop optional lines like {{poLine}} or {{weightLine}} cleanly when empty.',
        'If PORTAL FACTS has tonnage, add it as its own clear line under the price (e.g. "- Includes the first 3 tonnes, then £182.00 per tonne + VAT").',
        'price, fuelSurcharge, availableDate and zone come from PORTAL FACTS only. If price says "inc VAT" (residential), write it as inc VAT rather than "+ VAT".',
        'permitNote: if it starts with "ASK:", turn it into a short friendly question to the customer instead of stating a permit is or isn\'t needed.',
        'firstName is the sender\'s first name if known, otherwise use "there".',
        'Always: never include passwords, bank details or card numbers; never admit liability or offer compensation (write [CHECK: remedy needs approval]); spell correctly.',
        'If no template fits, write a brief helpful reply in the persona\'s style and set template_key to null.',
        persona ? `\nPERSONA (${persona.name}):\n${persona.persona}\n\nCurrent UK hour: ${ukHour}. Sign off as the persona says; for the generic team persona use userName's first name.` : 'Sign off with userName.',
      ].join('\n'),
      input: `TEMPLATES:\n${(templates ?? []).map((x: any) => `--- key=${x.template_key} (${x.name})\nSubject: ${x.subject}\n${x.body}`).join('\n\n')}\n\nSUGGESTED TEMPLATE: ${intent ?? 'none'}\n\nPORTAL FACTS:\n${JSON.stringify(found, null, 1)}\n\nEXTRACTED FROM EMAIL:\n${JSON.stringify(ex)}\n\nSENDER: ${t.sender_name ?? ''} <${t.sender_email ?? ''}>\nORIGINAL SUBJECT: ${t.subject ?? ''}\n\nTHREAD (oldest first):\n${thread}`,
      schema: SCHEMA,
    });
    if (!draft) return json({ error: 'AI returned no draft' }, 502);

    const patch = {
      ai_draft_subject: draft.subject, ai_draft_body: draft.body, ai_draft_template: draft.template_key,
      ai_draft_found: found, ai_draft_missing: draft.missing ?? [], ai_drafted_at: new Date().toISOString(),
      ai_draft_sent_at: null, ai_draft_edit_pct: null, ai_draft_persona: persona?.name ?? null, ai_draft_score: null,
    };
    await admin.from('crm_tickets').update(patch).eq('id', t.id);
    return json({ ...draft, found, stock, persona: persona?.name ?? null });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
