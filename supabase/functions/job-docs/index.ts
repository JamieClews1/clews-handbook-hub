import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { job_numbers, job_number, source } = await req.json();
    const table = source === "wtn" ? "wtn_documents" : "pod_documents";
    const bucket = source === "wtn" ? "wtn-documents" : "pods";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Single job -> return a short-lived signed download URL
    if (job_number) {
      const { data: pod, error } = await supabase
        .from(table)
        .select("storage_path, file_name")
        .or(`job_number.eq.${String(job_number)},file_name.ilike.%${String(job_number)}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!pod) {
        return new Response(JSON.stringify({ url: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: signed, error: sErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(pod.storage_path, 600, { download: pod.file_name });
      if (sErr) throw sErr;
      return new Response(JSON.stringify({ url: signed.signedUrl, file_name: pod.file_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch -> which job numbers have a POD
    const list: string[] = Array.isArray(job_numbers) ? job_numbers.map(String) : [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ available: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const capped = list.slice(0, 1000);
    const [podRes, wtnRes] = await Promise.all([
      supabase.from("pod_documents").select("job_number").in("job_number", capped),
      supabase.from("wtn_documents").select("job_number").in("job_number", capped),
    ]);
    if (podRes.error) throw podRes.error;
    if (wtnRes.error) throw wtnRes.error;
    const available = Array.from(new Set((podRes.data ?? []).map((r: any) => r.job_number).filter(Boolean)));
    const wtn_available = Array.from(new Set((wtnRes.data ?? []).map((r: any) => r.job_number).filter(Boolean)));
    return new Response(JSON.stringify({ available, wtn_available }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("job-docs error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
