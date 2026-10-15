import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const startOfDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const staffId = String(body?.staff_id ?? "");
    if (!staffId) return json({ error: "Not signed in" }, 401);
    const { data: staff } = await sb.from("yard_staff").select("id, staff_name").eq("id", staffId).eq("is_active", true).maybeSingle();
    if (!staff) return json({ error: "Not signed in" }, 401);

    if (action === "summary") {
      const since = startOfDay();
      const [g, c, s] = await Promise.all([
        sb.from("nf_grades").select("id, name, guidance, display_order").eq("is_active", true).order("display_order"),
        sb.from("nf_collections").select("*").eq("is_voided", false).gte("recorded_at", since).order("recorded_at", { ascending: false }),
        sb.from("nf_sort_entries").select("*").eq("is_voided", false).gte("recorded_at", since).order("recorded_at", { ascending: false }),
      ]);
      const recentSince = new Date(Date.now() - 7 * 864e5).toISOString();
      const [rc, rs] = await Promise.all([
        sb.from("nf_collections").select("*").eq("yard_staff_id", staff.id).gte("recorded_at", recentSince).order("recorded_at", { ascending: false }).limit(30),
        sb.from("nf_sort_entries").select("*").eq("yard_staff_id", staff.id).gte("recorded_at", recentSince).order("recorded_at", { ascending: false }).limit(50),
      ]);
      return json({ grades: g.data ?? [], collections: c.data ?? [], sorts: s.data ?? [], recentCollections: rc.data ?? [], recentSorts: rs.data ?? [] });
    }

    if (action === "add_collection" || action === "add_sort") {
      const weight = Number(body?.weight_kg);
      if (!(weight > 0) || weight > 50000) return json({ error: "Enter a valid weight in kg" }, 400);
      const clientRef = String(body?.client_ref ?? "") || null;
      const table = action === "add_collection" ? "nf_collections" : "nf_sort_entries";
      if (clientRef) {
        const { data: dup } = await sb.from(table).select("id").eq("client_ref", clientRef).maybeSingle();
        if (dup) return json({ ok: true, id: dup.id, duplicate: true });
      }
      const row: Record<string, unknown> = {
        weight_kg: weight, notes: body?.notes ? String(body.notes).slice(0, 1000) : null,
        staff_name: staff.staff_name, yard_staff_id: staff.id, client_ref: clientRef,
        recorded_at: body?.recorded_at ? String(body.recorded_at) : new Date().toISOString(),
      };
      if (action === "add_sort") {
        if (!body?.grade_id) return json({ error: "Choose a metal grade" }, 400);
        row.grade_id = String(body.grade_id);
        row.session_ref = body?.session_ref ? String(body.session_ref) : null;
      } else if (body?.photo_base64) {
        const path = `collections/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await sb.storage.from("metal-photos").upload(path, decodeBase64(String(body.photo_base64)), { contentType: "image/jpeg" });
        if (!upErr) row.photo_path = path;
      }
      const { data, error } = await sb.from(table).insert(row).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }

    if (action === "correct") {
      const table = body?.kind === "collection" ? "nf_collections" : "nf_sort_entries";
      const id = String(body?.id ?? "");
      const { data: rec } = await sb.from(table).select("*").eq("id", id).maybeSingle();
      if (!rec || rec.yard_staff_id !== staff.id) return json({ error: "You can only correct your own entries" }, 403);
      if (Date.now() - new Date(rec.created_at).getTime() > 24 * 3600e3) return json({ error: "Entries older than 24 hours must be corrected by the office" }, 403);
      const reason = String(body?.reason ?? "").trim() || null;
      if (body?.void) {
        await sb.from(table).update({ is_voided: true }).eq("id", id);
        await sb.from("nf_amendments").insert({ table_name: table, record_id: id, field: "is_voided", old_value: "false", new_value: "true", reason, amended_by_name: staff.staff_name });
      } else {
        const w = Number(body?.weight_kg);
        if (!(w > 0)) return json({ error: "Enter a valid weight" }, 400);
        await sb.from(table).update({ weight_kg: w }).eq("id", id);
        await sb.from("nf_amendments").insert({ table_name: table, record_id: id, field: "weight_kg", old_value: String(rec.weight_kg), new_value: String(w), reason, amended_by_name: staff.staff_name });
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
