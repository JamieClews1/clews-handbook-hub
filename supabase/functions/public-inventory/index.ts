import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = typeof body?.token === "string" ? body.token : "";
    }
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(token)) {
      return json({ error: "Invalid link" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkError } = await supabase
      .from("inventory_share_links")
      .select("id, label, is_active, show_values, show_photos, view_count")
      .eq("token", token)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link || !link.is_active) {
      return json({ error: "This link is no longer available" }, 404);
    }

    const { data: rows, error: rowsError } = await supabase
      .from("skip_inventory")
      .select(
        "id, asset_number, asset_type, size, condition, repairs_required, repair_notes, photos, last_location, last_cataloged_at, value_override",
      )
      .order("asset_number", { ascending: true });
    if (rowsError) throw rowsError;

    const { data: values } = await supabase
      .from("skip_inventory_condition_values")
      .select("asset_type, condition, value, size_group, sizes");

    const valueFor = (r: any) => {
      if (r.value_override !== null && r.value_override !== undefined) {
        return Number(r.value_override) || 0;
      }
      const matches = (values ?? []).filter(
        (v: any) => v.asset_type === r.asset_type && v.condition === (r.condition ?? ""),
      );
      const bySize = r.size
        ? matches.find((v: any) => (v.sizes ?? []).includes(r.size))
        : undefined;
      const fallback = matches.find((v: any) => !v.size_group);
      return Number((bySize ?? fallback)?.value ?? 0);
    };

    const items = (rows ?? []).map((r) => ({
      id: r.id,
      asset_number: r.asset_number,
      asset_type: r.asset_type,
      size: r.size,
      condition: r.condition,
      repairs_required: r.repairs_required,
      repair_notes: r.repair_notes,
      last_location: r.last_location,
      last_cataloged_at: r.last_cataloged_at,
      photos: link.show_photos ? r.photos ?? [] : [],
      value: link.show_values ? valueFor(r) : null,
    }));

    await supabase
      .from("inventory_share_links")
      .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);

    return json({
      label: link.label,
      show_values: link.show_values,
      show_photos: link.show_photos,
      items,
    });
  } catch (e) {
    console.error("public-inventory error", e);
    return json({ error: "Unable to load inventory" }, 500);
  }
});
