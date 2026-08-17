// Inbound email webhook: receives WTN/PDA PDFs emailed from Skiptrak and files
// them against the matching job. Works with Mailgun (multipart form) and
// Resend / CloudMailin style JSON payloads.
import { admin, BUCKET, corsHeaders, jobNumberFromFileName, lookupJob, processDocument } from "../_shared/wtn.ts";

type Incoming = { name: string; bytes: Uint8Array };

function b64ToBytes(b64: string) {
  const clean = b64.includes(",") ? b64.split(",").pop()! : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = admin();
  const attachments: Incoming[] = [];
  let from: string | null = null;
  let subject: string | null = null;

  try {
    const secret = Deno.env.get("WTN_INBOUND_SECRET");
    if (secret) {
      const url = new URL(req.url);
      const provided = url.searchParams.get("token") ?? req.headers.get("x-wtn-token");
      if (provided !== secret) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      from = (form.get("from") ?? form.get("sender")) as string | null;
      subject = form.get("subject") as string | null;
      for (const [, value] of form.entries()) {
        if (value instanceof File && /\.pdf$/i.test(value.name)) {
          attachments.push({ name: value.name, bytes: new Uint8Array(await value.arrayBuffer()) });
        }
      }
    } else {
      const body = await req.json();
      from = body.from?.address ?? body.from ?? body.sender ?? null;
      subject = body.subject ?? null;
      const list = body.attachments ?? body.Attachments ?? [];
      for (const a of list) {
        const name = a.filename ?? a.name ?? a.file_name ?? "document.pdf";
        const content = a.content ?? a.data ?? a.content_base64;
        if (!content || !/\.pdf$/i.test(name)) continue;
        attachments.push({
          name,
          bytes: typeof content === "string" ? b64ToBytes(content) : new Uint8Array(content),
        });
      }
    }

    const results: any[] = [];
    for (const att of attachments) {
      const jobNumber = jobNumberFromFileName(att.name);
      const job = await lookupJob(sb, jobNumber);
      const safe = att.name.replace(/[^\w.\-]/g, "_");
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safe}`;

      const up = await sb.storage.from(BUCKET).upload(path, att.bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;

      const { data: inserted, error: insErr } = await sb
        .from("wtn_documents")
        .insert({
          file_name: att.name,
          storage_path: path,
          file_size: att.bytes.byteLength,
          job_number: jobNumber,
          customer: job.customer,
          site: job.site,
          job_date: job.job_date,
          source: job.source ?? "skiptrak",
          received_via: "email",
          email_from: typeof from === "string" ? from.slice(0, 300) : null,
          email_subject: typeof subject === "string" ? subject.slice(0, 300) : null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      try {
        await processDocument(sb, inserted.id);
      } catch (e) {
        console.error("wtn parse failed", att.name, e);
      }
      results.push({ file: att.name, job_number: jobNumber, id: inserted.id });
    }

    return new Response(JSON.stringify({ received: attachments.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wtn-inbound error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
