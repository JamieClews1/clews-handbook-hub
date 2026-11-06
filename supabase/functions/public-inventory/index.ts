import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buyerValuation, fleetAllocation, profileType, profileValue } from "../_shared/inventory-valuation.ts";

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

    const backendUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!backendUrl || !serviceKey) throw new Error("Missing backend configuration");
    const supabase = createClient(backendUrl, serviceKey);

    const { data: link, error: linkError } = await supabase
      .from("inventory_share_links")
      .select("id, label, is_active, show_values, show_photos, verified_only, show_unverified_skips, show_unverified_roros, view_count")
      .eq("token", token)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link || !link.is_active) {
  
    return json({ error: "This link is no longer available" }, 404);
    }

    const rows = [];
    for (let offset = 0; ; offset += 500) {
    const { data: page, error: rowsError } = await supabase
      .from("skip_inventory")
      .select(
        "id, asset_number, asset_type, size, condition, repairs_required, repair_notes, photos, last_location, last_cataloged_at, value_override, office_verified",
      )
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (rowsError) throw rowsError;
    rows.push(...(page ?? []));
    if ((page ?? []).length < 500) break;
    }

    const { data: values, error: valuesError } = await supabase
      .from("skip_inventory_condition_values")
      .select("asset_type, condition, value, size_group, sizes");
    if (valuesError) throw valuesError;

    const valueFor = (r: any) => profileValue(r, values ?? []);

    const photoUrls = (p: any) =>
      Array.isArray(p)
        ? p.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean)
        : [];

    const HIDDEN_CONDITIONS = ["Yard Use", "Scrapped"];
    const visibleRows = (rows ?? []).filter(
      (r: any) =>
        !HIDDEN_CONDITIONS.includes(r.condition ?? "") &&
        (r.office_verified === true ||
          (r.asset_type === "roro" ? link.show_unverified_roros !== false : link.show_unverified_skips !== false)),
    );

    await supabase
      .from("inventory_share_links")
      .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);

    // Latest expected-fleet snapshot (written by the internal Stock Check), so
    // the share page can show what % of expected bins are catalogued.
    const { data: snapshot, error: snapshotError } = await supabase
      .from("inventory_expected_snapshot")
      .select("expected_skip, expected_roro, expected_total, computed_at, total_report")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) throw snapshotError;
    const { data: types, error: typesError } = await supabase.from("stock_check_container_types").select("id,name,category,data_hub_keywords");
    if (typesError) throw typesError;
    const valuation = link.show_values && snapshot?.total_report?.rowsByType
      ? buyerValuation(snapshot.total_report.rowsByType, rows, values ?? [], types ?? []) : null;


    const withinFleet = snapshot?.total_report?.rowsByType ? fleetAllocation(snapshot.total_report.rowsByType, rows as any[], types ?? []) : null;
    const items = visibleRows.map((r) => ({
      id: r.id,
      asset_number: r.asset_number,
      asset_type: r.asset_type,
      size: r.size,
      condition: r.condition,
      repairs_required: r.repairs_required,
      repair_notes: r.repair_notes,
      last_location: r.last_location,
      last_cataloged_at: r.last_cataloged_at,
      office_verified: r.office_verified === true,
      photos: link.show_photos ? photoUrls(r.photos) : [],
      value: link.show_values ? valueFor(r) : null,
      within_fleet: withinFleet ? withinFleet.has(r.id) : true,
      fleet_type_id: profileType(r.size ?? "", r.asset_type, types ?? [])?.id ?? null,
    }));
    return json({
      label: link.label,
      show_values: link.show_values,
      show_photos: link.show_photos,
      verified_only: link.show_unverified_skips === false && link.show_unverified_roros === false,
      items,
      expected: snapshot ?? null,
      valuation,
    });
  } catch (e) {
    console.error("public-inventory error", e);

    return json({ error: "Unable to load inventory" }, 500);
  }
});
