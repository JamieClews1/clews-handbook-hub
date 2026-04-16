import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [sizesRes, zonesRes, wastesRes, entriesRes] = await Promise.all([
      supabase.from("pricing_skip_sizes").select("id, display_name, size_code, display_order").eq("is_active", true).order("display_order"),
      supabase.from("postcode_zones").select("id, zone_name, postcodes, display_order").order("display_order"),
      supabase.from("pricing_waste_types").select("id, waste_type_name, display_order").eq("is_active", true).order("display_order"),
      supabase.from("pricing_entries").select("skip_size_id, zone_id, waste_type_id, status, price_ex_vat, tier"),
    ]);

    if (sizesRes.error || zonesRes.error || wastesRes.error || entriesRes.error) {
      throw new Error("Failed to fetch pricing data");
    }

    // Build a lookup map: { skip_size_code: { zone_name: { waste_type_name: { status, price } } } }
    const sizeMap = Object.fromEntries((sizesRes.data || []).map(s => [s.id, s]));
    const zoneMap = Object.fromEntries((zonesRes.data || []).map(z => [z.id, z]));
    const wasteMap = Object.fromEntries((wastesRes.data || []).map(w => [w.id, w]));

    const pricing: Record<string, Record<string, Record<string, Record<string, { status: string; price: number | null }>>>> = {};

    for (const entry of entriesRes.data || []) {
      const size = sizeMap[entry.skip_size_id];
      const zone = zoneMap[entry.zone_id];
      const waste = wasteMap[entry.waste_type_id];
      if (!size || !zone || !waste) continue;

      const tier = entry.tier || "residential";
      if (!pricing[tier]) pricing[tier] = {};
      if (!pricing[tier][size.size_code]) pricing[tier][size.size_code] = {};
      if (!pricing[tier][size.size_code][zone.zone_name]) pricing[tier][size.size_code][zone.zone_name] = {};
      pricing[tier][size.size_code][zone.zone_name][waste.waste_type_name] = {
        status: entry.status,
        price: entry.price_ex_vat,
      };
    }

    const response = {
      skip_sizes: sizesRes.data?.map(s => ({ code: s.size_code, name: s.display_name, order: s.display_order })),
      zones: zonesRes.data?.map(z => ({ name: z.zone_name, postcodes: z.postcodes, order: z.display_order })),
      waste_types: wastesRes.data?.map(w => ({ name: w.waste_type_name, order: w.display_order })),
      pricing,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error: any) {
    console.error("Pricing API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
