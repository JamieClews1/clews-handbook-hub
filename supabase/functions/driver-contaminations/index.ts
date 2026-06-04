import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reporterId: string | null = body?.reporterId ?? null;
    const reporterName: string | null = body?.reporterName ?? null;

    if (!reporterName && !reporterId) {
      return new Response(
        JSON.stringify({ error: "reporterId or reporterName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. This reporter's own contamination reports
    let myReportsQuery = supabase
      .from("contamination_queries")
      .select(
        "id, job_number, customer, site, contamination_type, status, approval_status, charge_amount, calculated_charge, points_awarded, photos, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (reporterId) {
      myReportsQuery = myReportsQuery.eq("reporter_driver_id", reporterId);
    } else {
      myReportsQuery = myReportsQuery.eq("reporter_name", reporterName);
    }

    const { data: myReports, error: reportsError } = await myReportsQuery;
    if (reportsError) throw reportsError;

    // 2. This reporter's total points
    let myPointsQuery = supabase
      .from("contamination_points")
      .select("points");
    if (reporterId) {
      myPointsQuery = myPointsQuery.eq("driver_id", reporterId);
    } else {
      myPointsQuery = myPointsQuery.eq("reporter_name", reporterName);
    }
    const { data: myPointsRows, error: myPointsError } = await myPointsQuery;
    if (myPointsError) throw myPointsError;
    const myPoints = (myPointsRows || []).reduce(
      (sum: number, r: { points: number }) => sum + (r.points || 0),
      0,
    );

    // 3. Leaderboard — total points per reporter (current month)
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const { data: allPoints, error: lbError } = await supabase
      .from("contamination_points")
      .select("reporter_name, points, awarded_at")
      .gte("awarded_at", startOfMonth.toISOString());
    if (lbError) throw lbError;

    const totals = new Map<string, { reporter_name: string; points: number; reports: number }>();
    for (const row of allPoints || []) {
      const name = row.reporter_name || "Unknown";
      const entry = totals.get(name) || { reporter_name: name, points: 0, reports: 0 };
      entry.points += row.points || 0;
      entry.reports += 1;
      totals.set(name, entry);
    }
    const leaderboard = Array.from(totals.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);

    return new Response(
      JSON.stringify({
        myReports: myReports || [],
        myPoints,
        leaderboard,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("driver-contaminations error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
