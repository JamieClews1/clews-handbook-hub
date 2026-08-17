// Parses (or re-parses) WTN PDFs: names, signatures and embedded photos.
// Also used to (re)match documents to Skiptrak jobs.
import { admin, corsHeaders, jobNumberFromFileName, lookupJob, processDocument } from "../_shared/wtn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = admin();
    const body = await req.json().catch(() => ({}));
    const ids: string[] = body.document_ids ?? (body.document_id ? [body.document_id] : []);
    const rematch: boolean = body.rematch !== false;

    let targets = ids;
    if (targets.length === 0) {
      // Default: everything not yet parsed successfully
      const { data, error } = await sb
        .from("wtn_documents")
        .select("id")
        .neq("parse_status", "parsed")
        .order("created_at", { ascending: true })
        .limit(25);
      if (error) throw error;
      targets = (data ?? []).map((d: any) => d.id);
    }

    const results: any[] = [];
    for (const id of targets) {
      try {
        if (rematch) {
          const { data: doc } = await sb
            .from("wtn_documents")
            .select("id, file_name, job_number")
            .eq("id", id)
            .maybeSingle();
          if (doc) {
            const jobNumber = doc.job_number || jobNumberFromFileName(doc.file_name);
            const job = await lookupJob(sb, jobNumber);
            await sb
              .from("wtn_documents")
              .update({
                job_number: jobNumber,
                customer: job.customer,
                site: job.site,
                job_date: job.job_date,
                source: job.source ?? "skiptrak",
              })
              .eq("id", id);
          }
        }
        results.push({ id, ...(await processDocument(sb, id)), ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wtn-parse error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
