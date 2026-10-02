import { supabase } from "@/integrations/supabase/client";

export type JobTicketPhoto = { id: string; url: string; label: string };

const prettify = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Driver (Route One) photos + photos parsed from the signed PDA ticket for a job number. */
export async function fetchJobTicketPhotos(jobNumber: string, signedSeconds = 60 * 60): Promise<JobTicketPhoto[]> {
  const job = (jobNumber || "").trim();
  if (!job) return [];
  const out: JobTicketPhoto[] = [];
  try {
    const { data: jobs } = await supabase.from("route_one_jobs").select("id").eq("job_number", job);
    const jobIds = (jobs ?? []).map((j) => j.id);
    if (jobIds.length) {
      const { data: rp } = await supabase
        .from("route_one_job_photos")
        .select("id, photo_type, file_path, created_at")
        .in("job_id", jobIds)
        .order("created_at");
      for (const p of rp ?? []) {
        out.push({
          id: p.id,
          url: supabase.storage.from("route-one-photos").getPublicUrl(p.file_path).data.publicUrl,
          label: prettify(p.photo_type || "photo"),
        });
      }
    }
    const { data: docs } = await supabase.from("wtn_documents").select("id").eq("job_number", job);
    const docIds = (docs ?? []).map((d) => d.id);
    if (docIds.length) {
      const { data: imgs } = await supabase
        .from("wtn_document_images")
        .select("id, storage_path, sort_order")
        .in("document_id", docIds)
        .eq("kind", "photo")
        .order("sort_order");
      for (const img of imgs ?? []) {
        const { data } = await supabase.storage.from("wtn-documents").createSignedUrl(img.storage_path, signedSeconds);
        if (data?.signedUrl) out.push({ id: img.id, url: data.signedUrl, label: "Ticket Photo" });
      }
    }
  } catch {
    // photos are optional
  }
  return out;
}
