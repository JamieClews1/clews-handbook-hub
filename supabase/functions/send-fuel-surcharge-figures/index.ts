// Emails the suggested fuel surcharge figures (rounded up) to a staff member.
// Read-only: computes from pricing_settings, never writes surcharge rates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

type CalcVehicle = "Skips" | "RoRo" | "Artic";
interface FuelCalcSettings {
  base_price_per_litre: number;
  miles_to_km_divisor: number;
  round_trip_miles: Record<CalcVehicle, [number, number, number]>;
  fuel_cost_per_km: Record<CalcVehicle, number>;
  grade_c_tonnes_per_load: number;
  grade_c_loads: number;
  grade_c_cost_per_tonne: number;
  grade_c_jobs: number;
  waste_loads: number;
  waste_cost_per_load: number;
  waste_jobs: number;
  yard_weekly_litres: number;
  yard_weekly_jobs: number;
  processing_reference_price: number;
}

const DEFAULTS: FuelCalcSettings = {
  base_price_per_litre: 1.1,
  miles_to_km_divisor: 0.63,
  round_trip_miles: { Skips: [7, 18, 28], RoRo: [7, 18, 32], Artic: [7, 18, 32] },
  fuel_cost_per_km: { Skips: 0.3776547392655039, RoRo: 0.5251253813666615, Artic: 0.7 },
  grade_c_tonnes_per_load: 14,
  grade_c_loads: 4,
  grade_c_cost_per_tonne: 3.9,
  grade_c_jobs: 250,
  waste_loads: 2,
  waste_cost_per_load: 3.1818181818181808,
  waste_jobs: 250,
  yard_weekly_litres: 1600,
  yard_weekly_jobs: 255,
  processing_reference_price: 1.45,
};

const fuelIncrease = (price: number, s: FuelCalcSettings) =>
  s.base_price_per_litre ? (price - s.base_price_per_litre) / s.base_price_per_litre : 0;

function processingLevy(price: number, s: FuelCalcSettings): number {
  const inc = fuelIncrease(price, s);
  const incRef = fuelIncrease(s.processing_reference_price, s);
  const gradeC = s.grade_c_jobs ? (s.grade_c_tonnes_per_load * s.grade_c_loads * s.grade_c_cost_per_tonne) / s.grade_c_jobs : 0;
  const waste = s.waste_jobs ? (s.waste_loads * s.waste_cost_per_load) / s.waste_jobs : 0;
  const diesel = s.yard_weekly_jobs ? (s.yard_weekly_litres / s.yard_weekly_jobs) * s.base_price_per_litre * incRef : 0;
  const atReference = gradeC + waste + diesel;
  return incRef ? atReference * (inc / incRef) : atReference;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Staff-only: require a valid user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const price = Number(body.price_per_litre);
    const to = String(body.to_email || "");
    if (!Number.isFinite(price) || price <= 0 || price > 10) {
      return new Response(JSON.stringify({ error: "Invalid price per litre" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || to.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid recipient email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load saved calculator settings (fall back to spreadsheet defaults)
    const { data: settingRow } = await supabase
      .from("pricing_settings")
      .select("value")
      .eq("key", "fuel_surcharge_calculator")
      .maybeSingle();
    const s: FuelCalcSettings = { ...DEFAULTS, ...(settingRow?.value ?? {}) };

    const inc = fuelIncrease(price, s);
    const proc = processingLevy(price, s);

    const rows: { vehicle: string; zone: string; exact: number; rounded: number }[] = [
      { vehicle: "Weighbridge Tip", zone: "—", exact: proc, rounded: Math.ceil(proc) },
    ];
    (["Skips", "RoRo", "Artic"] as CalcVehicle[]).forEach((v) => {
      s.round_trip_miles[v].forEach((miles, i) => {
        const km = s.miles_to_km_divisor ? miles / s.miles_to_km_divisor : 0;
        const total = km * s.fuel_cost_per_km[v] * inc + proc;
        rows.push({ vehicle: v, zone: `Zone ${i + 1}`, exact: total, rounded: Math.ceil(total) });
      });
    });

    const money = (n: number) => `£${n.toFixed(2)}`;
    const tableRows = rows.map((r) =>
      `<tr><td style="padding:6px 12px;border:1px solid #ddd">${r.vehicle}</td>` +
      `<td style="padding:6px 12px;border:1px solid #ddd">${r.zone}</td>` +
      `<td style="padding:6px 12px;border:1px solid #ddd;text-align:right">${money(r.exact)}</td>` +
      `<td style="padding:6px 12px;border:1px solid #ddd;text-align:right;font-weight:700">£${r.rounded}</td></tr>`
    ).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px">
        <h2 style="color:#16a34a">Fuel surcharge figures at ${money(price)}/litre</h2>
        <p>Fuel increase vs the ${money(s.base_price_per_litre)} base: <strong>${(inc * 100).toFixed(1)}%</strong>.
        Processing levy (weighbridge tip): <strong>${money(proc)}</strong>.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Vehicle</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Zone</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:right">Calculated</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:right">Rounded up</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="color:#6b7280;font-size:12px">Suggested figures only — no live surcharges have been changed. Customer-specific flat fees (e.g. Go Green) are not fuel-linked and are excluded.</p>
      </div>`;

    const { error: sendErr } = await resend.emails.send({
      from: "Clews Portal <accounts@noreply.clewsrecycling.co.uk>",
      to: [to],
      subject: `Fuel surcharge figures at ${money(price)}/litre (rounded up)`,
      html,
    });
    if (sendErr) throw sendErr;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
