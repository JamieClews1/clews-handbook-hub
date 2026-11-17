// Reads a purchase order — a PDF attached to an Inbox email, a PDF uploaded from
// Route One's New Job window, or pasted order text — interprets it with AI,
// and checks the price against the rate cards and the date against the bookings
// board. It never creates jobs or sends email — it only returns the
// interpretation and flags for staff to review.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiJson } from '../_shared/ai-responses.ts';
import { matchMatrixPostcode, MATRIX_ZONE_TO_CODE } from '../_shared/matrix-postcode-zone.ts';

const RORO_RE = /ro\s*-?\s*ro|roll[- ]?on|\b(20|25|30|35|40)\s*-?\s*(yd|yds|yrd|yard)/i;
const DAYS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** Next date for a booking-board day code (today counts), as YYYY-MM-DD (London). */
function bookingDateIso(day: string | null | undefined): string | null {
  const target = DAYS[String(day ?? '').trim().toUpperCase()];
  if (target === undefined) return null;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  now.setDate(now.getDate() + ((target - now.getDay() + 7) % 7));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const MAX_UPLOAD_BASE64 = 14_000_000; // ~10 MB PDF
const Body = z.object({
  attachmentId: z.string().uuid().optional(),
  ticketId: z.string().uuid().optional(),
  file: z.object({ name: z.string().max(300), data: z.string().min(1).max(MAX_UPLOAD_BASE64) }).optional(),
  text: z.string().min(1).max(60000).optional(),
}).refine((b) => b.attachmentId || b.ticketId || b.file || b.text, { message: 'A PO file, pasted text, attachmentId or ticketId is required' });

// Broker trading names that Skiptrak books under a parent account.
const PARENT_ACCOUNTS: { re: RegExp; account: string }[] = [
  { re: /reconomy|circle\s*waste|aws\s*nationwide/i, account: 'Reconomy (UK) Limited' },
  { re: /go\s*green|waste\s*online/i, account: 'Go Green Limited' },
];

const companyKey = (v: string | null | undefined) =>
  String(v ?? '').toLowerCase().replace(/&/g, ' and ').replace(/\b(t\/a.*|ltd|limited|plc|llp|uk|the|co|company|group)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** "t/a Circle Waste" style trading names printed on the PO. */
function tradingNames(text: string): string[] {
  return [...text.matchAll(/t\/a\s+([A-Z][A-Za-z&' ]{2,40}?)(?=[.,\n]|\s{2}|\s+(?:The|Notification|Our)\b)/g)].map((m) => m[1].trim()).slice(0, 3);
}

type Account = { customer_name: string; customer_code: string | null; data_hub_customer: string | null; waste_carrier_licence: string | null };
const OWN_LICENCE = 'CBDU203180';
const GENERIC_DOMAINS = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|aol|btinternet|sky|clewsrecycling)$/i;

/** Broker from the sending email domain (Inbox reads only), e.g. info@opteco.uk → Opteco UK Ltd. */
function matchSenderDomain(email: string | null, accounts: Account[]) {
  const label = String(email ?? '').toLowerCase().split('@')[1]?.split('.')[0] ?? '';
  if (label.length < 4 || GENERIC_DOMAINS.test(label)) return null;
  const parent = PARENT_ACCOUNTS.find((p) => p.re.test(label));
  if (parent) return matchPoAccount([parent.account], accounts, email!);
  const hits = accounts.filter((a) => { const k = companyKey(a.customer_name).replace(/ /g, ''); return k.length >= 4 && (k === label || k.startsWith(label) || label.startsWith(k)); });
  const names = [...new Set(hits.map((h) => h.customer_name))];
  return names.length === 1 ? { customer_name: hits[0].customer_name, customer_code: hits[0].customer_code, matched_from: email! } : null;
}

/** Broker from its waste carrier licence printed on the PO (Clews' own licence ignored); only a single account counts. */
function matchCarrierLicence(text: string, accounts: Account[]) {
  const licences = [...new Set([...text.matchAll(/CBDU\s*\d{4,7}/gi)].map((m) => m[0].replace(/\s/g, '').toUpperCase()))].filter((l) => l !== OWN_LICENCE);
  for (const l of licences) {
    const hits = accounts.filter((a) => String(a.waste_carrier_licence ?? '').replace(/\s/g, '').toUpperCase() === l);
    const parent = hits.length > 1 ? PARENT_ACCOUNTS.find((p) => hits.some((h) => p.re.test(h.customer_name))) : null;
    if (parent) return matchPoAccount([parent.account], accounts, `carrier licence ${l}`);
    if (hits.length === 1) return { customer_name: hits[0].customer_name, customer_code: hits[0].customer_code, matched_from: `carrier licence ${l}` };
  }
  return null;
}
function matchPoAccount(names: (string | null | undefined)[], accounts: Account[], from?: string): { customer_name: string; customer_code: string | null; matched_from: string } | null {
  for (const raw of names) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    const parent = PARENT_ACCOUNTS.find((p) => p.re.test(name));
    const wanted = companyKey(parent?.account ?? name);
    if (!wanted) continue;
    const hit = accounts.find((a) => [a.customer_name, a.data_hub_customer].some((n) => n && companyKey(n) === wanted));
    if (hit) return { customer_name: hit.customer_name, customer_code: hit.customer_code, matched_from: from ?? name };
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:[^,]*,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const PO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    po_number: { type: ['string', 'null'] },
    broker: { type: ['string', 'null'], description: 'Company that issued the PO, e.g. Reconomy, GoGreen, LB Waste, Project Waste, YardLink' },
    end_customer: { type: ['string', 'null'], description: 'The customer the work is for, if different from the broker' },
    site_name: { type: ['string', 'null'] },
    site_address: { type: ['string', 'null'] },
    postcode: { type: ['string', 'null'] },
    container: { type: ['string', 'null'], description: 'e.g. "8 yard skip", "40 yard RoRo"' },
    waste_type: { type: ['string', 'null'] },
    ewc_code: { type: ['string', 'null'] },
    service: { type: ['string', 'null'], enum: ['delivery', 'exchange', 'collection', 'wait_and_load', null] },
    requested_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    price_net: { type: ['number', 'null'], description: 'Net price before VAT for the hire/movement, excluding disposal per-tonne charges' },
    extras: { type: ['string', 'null'], description: 'Other chargeable items on the PO, e.g. permit, tonnage rate' },
    site_contact_name: { type: ['string', 'null'], description: 'Name of the contact on site' },
    site_contact_phone: { type: ['string', 'null'], description: 'Phone number(s) for the site contact, as written' },
    order_notes: { type: ['string', 'null'], description: 'The ORDER NOTES / special instructions / comments section, copied word for word in full' },
    time_preference: { type: ['string', 'null'], description: 'Time preference or slot, as written' },
    end_customer_is_private: { type: ['boolean', 'null'], description: 'true when the end customer is a private individual/householder rather than a business' },
    notes: { type: ['string', 'null'], description: 'Other job-specific instructions copied in full: site access notes, access codes, what3words, opening times, extra site contacts, PPE and paperwork requirements for this job (e.g. SIC code / Waste Hierarchy statement on documents). Do NOT include standard terms and conditions, numbered conditions of supply, payment terms, invoicing instructions, rebate/weight reporting addresses or legal small print. Do not repeat order notes, contact or time preference here.' },
  },
  required: ['po_number', 'broker', 'end_customer', 'site_name', 'site_address', 'postcode', 'container', 'waste_type', 'ewc_code', 'service', 'requested_date', 'price_net', 'extras', 'site_contact_name', 'site_contact_phone', 'order_notes', 'time_preference', 'end_customer_is_private', 'notes'],
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

    // Get the PO text from an uploaded PDF, pasted text, or an Inbox attachment.
    let fileName = 'Pasted PO';
    let attachmentId: string | null = null;
    let bytes: Uint8Array | null = null;
    let raw = '';
    let senderEmail: string | null = null;
    if (parsed.data.text) {
      raw = parsed.data.text.trim();
    } else if (parsed.data.file) {
      fileName = parsed.data.file.name || 'PO.pdf';
      bytes = base64ToBytes(parsed.data.file.data);
      if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return json({ error: 'That file is not a PDF' }, 400);
    } else {
      let q = admin.from('crm_ticket_attachments').select('id, ticket_id, file_name, content_type, storage_path');
      if (parsed.data.attachmentId) q = q.eq('id', parsed.data.attachmentId);
      else q = q.eq('ticket_id', parsed.data.ticketId!).ilike('content_type', '%pdf%').order('created_at').limit(1);
      const { data: att } = await q.maybeSingle();
      if (!att?.storage_path) return json({ error: 'No PDF attachment found on this email' }, 404);
      const { data: blob, error: dlErr } = await admin.storage.from('crm-attachments').download(att.storage_path);
      if (dlErr || !blob) return json({ error: `Could not download the attachment: ${dlErr?.message ?? 'not found'}` }, 500);
      bytes = new Uint8Array(await blob.arrayBuffer());
      fileName = att.file_name;
      attachmentId = att.id;
      const { data: tk } = await admin.from('crm_tickets').select('sender_email').eq('id', att.ticket_id).maybeSingle();
      senderEmail = tk?.sender_email ?? null;
    }
    if (bytes) {
      const { extractText, getDocumentProxy } = await import('https://esm.sh/unpdf@0.12.1');
      const doc = await getDocumentProxy(bytes.slice());
      const { text } = await extractText(doc, { mergePages: true });
      raw = (Array.isArray(text) ? text.join('\n') : String(text ?? '')).trim();
    }

    const instructions =
      'You are reading a purchase order sent to Clews Recycling, a UK skip and RoRo hire company. ' +
      'Extract the order details exactly as written. Dates are UK format (day before month). ' +
      'price_net is the net hire/movement price before VAT, excluding any per-tonne disposal rate; if several prices appear, use the main hire line. ' +
      'service is delivery (dropping off), exchange (swap), collection (pick up) or wait_and_load. ' +
      'Copy the order notes section in full, word for word — never shorten or summarise it. Leave out standard terms and conditions and payment small print. ' +
      'broker is the company that issued the PO (letterhead, or "t/a" trading name) — it is never the waste producer/site account; if the issuer\'s name is not printed (logo only), broker is null. ' +
      'end_customer is the customer/waste producer the work is for. Use null for anything not stated — never guess.';
    let po: any = null;
    if (raw) {
      po = await aiJson(apiKey, { name: 'purchase_order', effort: 'low', instructions, input: `File: ${fileName}\n\n${raw.slice(0, 60000)}`, schema: PO_SCHEMA });
    } else if (bytes) {
      // Scanned PDF with no text layer: let the AI look at the pages instead.
      try {
        po = await aiJson(apiKey, {
          name: 'purchase_order', effort: 'low', instructions, schema: PO_SCHEMA,
          input: [{ role: 'user', content: [
            { type: 'input_file', filename: fileName, file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}` },
            { type: 'input_text', text: `File: ${fileName}. This is a scanned purchase order; read it from the page images.` },
          ] }],
        });
      } catch (e) {
        console.error('crm-read-po scanned fallback failed', e);
        return json({ error: 'Could not read any text from that PDF — it may be a scanned image. Try pasting the order text instead.' }, 400);
      }
    } else {
      return json({ error: 'No order text to read' }, 400);
    }
    if (!po) return json({ error: 'The AI could not interpret that PO' }, 500);

    // ---- Checks ----------------------------------------------------------------
    const flags: { level: 'red' | 'amber'; message: string }[] = [];
    if (po.price_net != null && Number(po.price_net) <= 0) {
      po.price_net = null;
      flags.push({ level: 'amber', message: 'The PO shows no price (£0) — confirm the price with the broker before booking.' });
    }

    // Customer account: broker POs are booked under the broker's account (as in Skiptrak),
    // with the end customer as the site. Never guessed — unmatched issuers are flagged.
    const accounts: Account[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page } = await admin.from('customers').select('customer_name, customer_code, data_hub_customer, waste_carrier_licence').eq('is_active', true).order('id').range(from, from + 999);
      accounts.push(...((page ?? []) as Account[]));
      if (!page || page.length < 1000) break;
    }
    const account = matchSenderDomain(senderEmail, accounts)
      ?? matchPoAccount([po.broker, ...tradingNames(raw)], accounts)
      ?? matchCarrierLicence(raw, accounts)
      ?? (po.broker ? null : matchPoAccount([po.end_customer], accounts));
    if (!account && (po.broker || po.end_customer)) {
      flags.push({ level: 'amber', message: `${po.broker || po.end_customer} isn't matched to a customer account — choose the customer before booking.` });
    }
    const containerText = String(po.container ?? '');
    const wasteText = String(po.waste_type ?? '').toLowerCase();
    const isRoRo = RORO_RE.test(containerText);

    // Zone from the pricing matrix only — never a guessed default.
    let zoneLabel: string | null = null;
    if (po.postcode) {
      const { data: rows } = await admin.from('pricing_zone_postcodes').select('postcode_prefix, zone_code, area');
      const m = matchMatrixPostcode(String(po.postcode), (rows ?? []) as any);
      if (m.status === 'matched') zoneLabel = m.zone;
      else if (m.status === 'ambiguous') flags.push({ level: 'amber', message: `Postcode ${po.postcode} is split between zones on the pricing matrix — confirm the zone before booking.` });
      else flags.push({ level: 'amber', message: `Postcode ${po.postcode} is not on the pricing matrix — confirm the zone before booking.` });
    } else {
      flags.push({ level: 'amber', message: 'No postcode found on the PO — zone and price could not be checked.' });
    }

    // Expected price from the Trade Rates card (brokers are trade customers).
    let expected: { price: number; label: string; card: string; included_tonnes: number | null } | null = null;
    if (zoneLabel && containerText) {
      const zoneCode = MATRIX_ZONE_TO_CODE[zoneLabel];
      const { data: card } = await admin.from('pricing_rate_cards').select('id, name').eq('name', 'Trade Rates 2026').eq('is_active', true).maybeSingle();
      if (card && zoneCode) {
        const { data: rows } = await admin.from('pricing_rate_card_rows').select('id, section, label').eq('card_id', card.id);
        const { data: zones } = await admin.from('pricing_rate_card_zones').select('id, zone_code').eq('card_id', card.id);
        const cat = !wasteText.trim() ? 'general' : /plaster/.test(wasteText) ? 'plaster' : /wood/.test(wasteText) ? 'wood' : /green|garden/.test(wasteText) ? 'green'
          : /inert|hardcore|rubble|soil|concrete|brick/.test(wasteText) ? 'inert' : 'general';
        const sectionRe: Record<string, RegExp> = isRoRo
          ? { plaster: /roro.*general/i, wood: /roro.*general/i, green: /roro.*general/i, inert: /roro.*inert/i, general: /roro.*general/i }
          : { plaster: /plasterboard/i, wood: /wood/i, green: /wood|green/i, inert: /inert/i, general: /skip hire.*general/i };
        const size = containerText.match(/(\d+)\s*-?\s*(yd|yrd|yard|cubic)/i)?.[1];
        const enclosed = /enclosed|lockable|lid/i.test(containerText);
        const row = (rows ?? []).filter((r: any) => sectionRe[cat].test(r.section) && !/haulage/i.test(r.section))
          .filter((r: any) => !size || isRoRo || new RegExp(`\\b${size}\\b`).test(r.label))
          .sort((a: any, b: any) => Number(/enclosed/i.test(a.label) !== enclosed) - Number(/enclosed/i.test(b.label) !== enclosed))[0];
        const zone = (zones ?? []).find((z: any) => z.zone_code === zoneCode);
        if (row && zone) {
          const { data: v } = await admin.from('pricing_rate_card_values').select('status, price, included_tonnes').eq('row_id', row.id).eq('zone_id', zone.id).maybeSingle();
          if (v?.status === 'price' && v.price != null) expected = { price: Number(v.price), label: row.label, card: card.name, included_tonnes: v.included_tonnes != null ? Number(v.included_tonnes) : null };
        }
      }
    }

    if (po.price_net != null && expected) {
      const diff = Number(po.price_net) - expected.price;
      if (Math.abs(diff) > 1) {
        flags.push({
          level: diff < 0 ? 'red' : 'amber',
          message: diff < 0
            ? `PO price £${Number(po.price_net).toFixed(2)} is BELOW the rate card (£${expected.price.toFixed(2)} — ${expected.label}, ${zoneLabel}). Check before accepting.`
            : `PO price £${Number(po.price_net).toFixed(2)} is above the rate card (£${expected.price.toFixed(2)} — ${expected.label}, ${zoneLabel}).`,
        });
      }
    } else if (po.price_net != null && zoneLabel && !expected) {
      flags.push({ level: 'amber', message: 'No matching rate-card price found to check the PO price against.' });
    }

    // Date doability: past, Sunday, or earlier than the bookings board allows.
    if (po.requested_date) {
      const reqDate = new Date(`${po.requested_date}T12:00:00Z`);
      const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
      if (po.requested_date < todayIso) {
        flags.push({ level: 'red', message: `Requested date ${po.requested_date} is in the past.` });
      } else if (reqDate.getUTCDay() === 0) {
        flags.push({ level: 'red', message: `Requested date ${po.requested_date} is a Sunday — we don't deliver on Sundays.` });
      } else if (zoneLabel) {
        const { data: wins } = await admin.from('route_one_booking_windows').select('zone_label, skip_day, roro_day');
        const n = zoneLabel.match(/zone\s*(\d)/i)?.[1];
        const win = (wins ?? []).find((w: any) => n && new RegExp(`\\b${n}\\b`).test(w.zone_label));
        const earliest = win ? bookingDateIso(isRoRo ? win.roro_day : win.skip_day) : null;
        if (earliest && po.requested_date < earliest) {
          flags.push({ level: 'amber', message: `Requested date ${po.requested_date} is earlier than the bookings board allows for ${zoneLabel} (earliest ${earliest}).` });
        }
      }
    } else {
      flags.push({ level: 'amber', message: 'No date found on the PO.' });
    }

    return json({ attachment: { id: attachmentId, file_name: fileName }, po, account, zone: zoneLabel, expected, flags });
  } catch (e) {
    console.error('crm-read-po error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
