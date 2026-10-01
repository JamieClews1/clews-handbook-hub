// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('DWT_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('DWT_CLIENT_SECRET') ?? '';
const BASE_URL = (Deno.env.get('DWT_API_BASE_URL') ?? 'https://waste-tracking.integration.api.defra.gov.uk').replace(/\/+$/, '');
const ENVIRONMENT = Deno.env.get('DWT_ENVIRONMENT') ?? 'sandbox';

const TOKEN_BASE_URL = Deno.env.get('DWT_OAUTH_BASE_URL') ?? (
  ENVIRONMENT === 'production'
    ? 'https://waste-movement-external-api-75ee2.auth.eu-west-2.amazoncognito.com'
    : 'https://waste-movement-external-api-8ec5c.auth.eu-west-2.amazoncognito.com'
);
const TOKEN_URL = `${TOKEN_BASE_URL.replace(/\/+$/, '')}/oauth2/token`;

async function getAccessToken(): Promise<{ token?: string; error?: string; raw?: any }> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { error: 'DWT_CLIENT_ID / DWT_CLIENT_SECRET not configured' };
  }
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || !json.access_token) {
    return { error: `Token exchange failed (${res.status}): ${text.slice(0, 300)}`, raw: json };
  }
  return { token: json.access_token, raw: json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const action = body.action ?? 'submit';

    // Test connectivity: just exchange a token and return status
    if (action === 'test') {
      const tok = await getAccessToken();
      return new Response(JSON.stringify({
        ok: !!tok.token,
        environment: ENVIRONMENT,
        base_url: BASE_URL,
        error: tok.error ?? null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Submit one or many receipts
    const receipts: any[] = Array.isArray(body.receipts) ? body.receipts : (body.receipt ? [body.receipt] : []);
    if (receipts.length === 0) {
      return new Response(JSON.stringify({ error: 'No receipts supplied' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tok = await getAccessToken();
    if (!tok.token) {
      // Log token failure against each row so the user can see why
      for (const r of receipts) {
        await supabase.from('dwt_submissions').insert({
          job_id: r.job_id,
          ticket_number: r.ticket_number ?? null,
          status: 'error',
          environment: ENVIRONMENT,
          request_payload: r.payload ?? r,
          error_message: tok.error ?? 'token exchange failed',
          submitted_by: userId,
        });
      }
      return new Response(JSON.stringify({ ok: false, error: tok.error }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = `${BASE_URL}/movements/receive`;
    const results: any[] = [];

    // Load API Code from company_profile (falls back to sandbox dummy #1)
    const { data: profileRow } = await supabase
      .from('company_profile')
      .select('dwt_api_code')
      .limit(1)
      .maybeSingle();
    const defaultApiCode = profileRow?.dwt_api_code || '1f83215e-4b90-4785-9ab2-2614839aa2e9';

    // Receiver details from company profile
    const { data: cp } = await supabase
      .from('company_profile')
      .select('company_name, trading_name, operational_address, registered_address, environment_agency_reference, email, telephone')
      .limit(1)
      .maybeSingle();
    const siteAddress = (cp?.operational_address || cp?.registered_address || 'Unit 17 Waste Transfer Station, Hunters Lane, Rugby CV21 1EA').trim();
    const pcMatch = siteAddress.toUpperCase().match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/);
    const sitePostcode = pcMatch ? pcMatch[0].replace(/\s*(\d[A-Z]{2})$/, ' $1') : 'CV21 1EA';

    // DEFRA container-type codes (case-sensitive) — fetch once
    let containerTypes: { code: string; description: string }[] = [];
    try {
      const ct = await fetch(`${BASE_URL}/reference-data/container-types`, { headers: { Authorization: `Bearer ${tok.token}`, Accept: 'application/json' } });
      if (ct.ok) {
        const j = await ct.json();
        const arr = Array.isArray(j) ? j : (j?.data ?? j?.containerTypes ?? []);
        containerTypes = arr.map((x: any) => ({ code: String(x.code ?? x.id ?? ''), description: String(x.description ?? x.name ?? '') })).filter((x: any) => x.code);
      }
    } catch { /* fall back below */ }
    const mapContainer = (raw: string): string => {
      const s = (raw || '').toLowerCase();
      if (containerTypes.some((c) => c.code === raw)) return raw;
      const find = (re: RegExp) => containerTypes.find((c) => re.test(c.description.toLowerCase()))?.code;
      if (/ro\s*-?\s*ro|roll/.test(s)) return find(/roll|ro-?ro/) ?? find(/skip/) ?? 'SKI';
      if (/compact|portapack/.test(s)) return find(/compact/) ?? find(/skip/) ?? 'SKI';
      if (/skip|yd|yard/.test(s)) return find(/skip/) ?? 'SKI';
      if (/bale/.test(s)) return find(/bale/) ?? 'SKI';
      if (/bin|wheelie/.test(s)) return find(/wheelie/) ?? 'WBI';
      if (/van|truck|lorry|loose|bulk/.test(s)) return find(/bulk|loose|vehicle/) ?? 'SKI';
      return find(/skip/) ?? 'SKI';
    };

    const toDefra = (p: any): any => {
      if (!p?.wasteMovement) return p; // already in DEFRA shape
      const m = p.wasteMovement;
      const date = m.receivedAt ? String(m.receivedAt).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const time = /^\d{1,2}:\d{2}(:\d{2})?$/.test(m.receivedTime ?? '') ? (m.receivedTime.length === 5 ? `${m.receivedTime}:00` : m.receivedTime).padStart(8, '0') : '12:00:00';
      const forms = ['Gas', 'Liquid', 'Solid', 'Powder', 'Sludge', 'Mixed'];
      const pf = forms.find((f) => f.toLowerCase() === String(m.waste?.physicalForm ?? '').toLowerCase()) ?? 'Solid';
      const transports = ['Road', 'Rail', 'Air', 'Sea', 'Inland Waterway', 'Piped', 'Other'];
      const mot = transports.find((t) => t.toLowerCase() === String(m.carrier?.meansOfTransport ?? '').toLowerCase()) ?? 'Road';
      const ewc = String(m.waste?.ewcCode ?? '').replace(/\D/g, '').slice(0, 6);
      const carrierReg = (m.carrier?.registrationNumber ?? '').trim();
      const out: any = {
        apiCode: p.apiCode,
        dateTimeReceived: new Date(`${date}T${time}Z`).toISOString(),
        reasonForNoConsignmentCode: 'Non-Haz Waste Transfer',
        yourUniqueReference: String(m.ticketNumber ?? ''),
        wasteItems: [{
          ewcCodes: ewc ? [ewc] : [],
          wasteDescription: m.waste?.description || 'Mixed waste',
          physicalForm: pf,
          numberOfContainers: 1,
          typeOfContainers: mapContainer(m.waste?.containerType ?? ''),
          weight: { metric: 'Tonnes', amount: Number(m.waste?.weightTonnes ?? 0), isEstimate: false },
          containsPops: false,
          containsHazardous: false,
        }],
        carrier: {
          registrationNumber: carrierReg || null,
          ...(carrierReg ? {} : { reasonForNoRegistrationNumber: 'Not provided' }),
          organisationName: m.carrier?.name || 'Unknown carrier',
          meansOfTransport: mot,
          ...(m.carrier?.vehicleRegistration ? { vehicleRegistration: String(m.carrier.vehicleRegistration).replace(/\s+/g, '').slice(0, 10) } : {}),
        },
        receiver: {
          siteName: cp?.trading_name || cp?.company_name || 'Clews Recycling Ltd',
          authorisationNumber: String(p.receiverAuthorisationNumber || cp?.environment_agency_reference || 'EAWML48106').replace(/^(EAWML|WML)\s+/i, '$1').trim(),
        },
        receipt: { address: { fullAddress: siteAddress, postcode: sitePostcode } },
      };
      if (m.producer?.name) out.otherReferencesForMovement = [{ label: 'Producer', reference: String(m.producer.name) }];
      return out;
    };

    for (const r of receipts) {
      const payload = toDefra({ ...(r.payload ?? r) });
      if (!payload.apiCode) payload.apiCode = defaultApiCode;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tok.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let respJson: any;
      try { respJson = JSON.parse(text); } catch { respJson = { raw: text }; }
      const wtId = respJson?.wasteTrackingId ?? respJson?.wtId ?? respJson?.id ?? null;
      const success = resp.ok;

      await supabase.from('dwt_submissions').insert({
        job_id: r.job_id,
        ticket_number: r.ticket_number ?? null,
        wt_id: wtId,
        status: success ? 'submitted' : 'error',
        environment: ENVIRONMENT,
        request_payload: payload,
        response_body: respJson,
        http_status: resp.status,
        error_message: success ? null : (respJson?.validation?.errors ? respJson.validation.errors.map((e: any) => e.message).join('; ').slice(0, 500) : (respJson?.message ?? text.slice(0, 500))),
        submitted_by: userId,
      });

      results.push({ job_id: r.job_id, ok: success, http_status: resp.status, wt_id: wtId, response: respJson });
    }

    const allOk = results.every((x) => x.ok);
    return new Response(JSON.stringify({ ok: allOk, results }), {
      status: allOk ? 200 : 207,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
