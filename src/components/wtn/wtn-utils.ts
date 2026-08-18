import { supabase } from "@/integrations/supabase/client";

export const WTN_BUCKET = "wtn-documents";

export type WtnDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  job_number: string | null;
  source: string | null;
  customer: string | null;
  site: string | null;
  job_date: string | null;
  customer_name: string | null;
  driver_name: string | null;
  customer_signature_path: string | null;
  driver_signature_path: string | null;
  parse_status: string;
  parse_error: string | null;
  received_via: string;
  email_from: string | null;
  email_subject: string | null;
  created_at: string;
};

export type WtnImage = {
  id: string;
  document_id: string;
  storage_path: string;
  kind: string;
  width: number | null;
  height: number | null;
  sort_order: number;
};

export const WTN_SELECT =
  "id, file_name, storage_path, file_size, job_number, source, customer, site, job_date, customer_name, driver_name, customer_signature_path, driver_signature_path, parse_status, parse_error, received_via, email_from, email_subject, created_at";

/** Guess a Skiptrak job number from a WTN filename. */
export function jobNumberFromFileName(name: string): string | null {
  const base = name.replace(/\.pdf$/i, "");
  const tagged = base.match(/(?:wtn|job|ticket|pda)[\s_\-#]*0*(\d{3,8})/i);
  if (tagged) return tagged[1];
  const plain = base.match(/\b0*(\d{4,8})\b/);
  return plain ? plain[1] : null;
}

export async function signedUrl(path: string | null, expires = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(WTN_BUCKET).createSignedUrl(path, expires);
  return data?.signedUrl ?? null;
}

export function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload one PDF, match it to a job and kick off parsing. */
export async function uploadWtnPdf(file: File, replaceExisting = false) {
  if (replaceExisting) {
    const { data: existing } = await supabase
      .from("wtn_documents")
      .select("id, storage_path")
      .eq("file_name", file.name);
    if (existing?.length) {
      const ids = existing.map((d: any) => d.id);
      const { data: imgs } = await supabase.from("wtn_document_images").select("storage_path").in("document_id", ids);
      const paths = [
        ...existing.map((d: any) => d.storage_path).filter(Boolean),
        ...((imgs ?? []).map((i: any) => i.storage_path).filter(Boolean)),
      ];
      if (paths.length) await supabase.storage.from(WTN_BUCKET).remove(paths);
      await supabase.from("wtn_documents").delete().in("id", ids);
    }
  }

  const jobNumber = jobNumberFromFileName(file.name);

  let job: { customer: string | null; site: string | null; job_date: string | null; source: string | null } = {
    customer: null,
    site: null,
    job_date: null,
    source: "skiptrak",
  };
  if (jobNumber) {
    const { data } = await supabase
      .from("data_hub_jobs")
      .select("customer, site, job_date, source")
      .eq("job_number", jobNumber)
      .order("job_date", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row) job = { customer: row.customer, site: row.site, job_date: row.job_date, source: row.source };
  }

  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from(WTN_BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { data: userData } = await supabase.auth.getUser();
  const { data: inserted, error } = await supabase
    .from("wtn_documents")
    .insert({
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      job_number: jobNumber,
      customer: job.customer,
      site: job.site,
      job_date: job.job_date,
      source: job.source ?? "skiptrak",
      received_via: "manual",
      uploaded_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id as string;
}

export async function parseWtnDocuments(documentIds?: string[]) {
  const { data, error } = await supabase.functions.invoke("wtn-parse", {
    body: documentIds?.length ? { document_ids: documentIds } : {},
  });
  if (error) throw error;
  return data;
}
