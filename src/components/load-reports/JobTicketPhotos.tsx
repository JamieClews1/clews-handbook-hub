import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Photo = { id: string; url: string; label: string };

const prettify = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Shows every photo attached to the job ticket (driver photos captured in
 * Route One + photos parsed from the signed PDA waste transfer note) for the
 * job number entered on a load report.
 */
export const JobTicketPhotos = ({ jobNumber }: { jobNumber: string | null | undefined }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const job = (jobNumber || "").trim();
    let cancelled = false;

    if (!job) {
      setPhotos([]);
      return;
    }

    const run = async () => {
      setLoading(true);
      const collected: Photo[] = [];

      try {
        // 1) Route One driver photos for this job number
        const { data: jobs } = await supabase
          .from("route_one_jobs")
          .select("id")
          .eq("job_number", job);
        const jobIds = (jobs ?? []).map((j) => j.id);
        if (jobIds.length) {
          const { data: rp } = await supabase
            .from("route_one_job_photos")
            .select("id, photo_type, file_path, file_name, created_at")
            .in("job_id", jobIds)
            .order("created_at");
          for (const p of rp ?? []) {
            collected.push({
              id: p.id,
              url: supabase.storage.from("route-one-photos").getPublicUrl(p.file_path).data.publicUrl,
              label: prettify(p.photo_type || "photo"),
            });
          }
        }

        // 2) Photos parsed out of the signed PDA waste transfer note
        const { data: docs } = await supabase
          .from("wtn_documents")
          .select("id")
          .eq("job_number", job);
        const docIds = (docs ?? []).map((d) => d.id);
        if (docIds.length) {
          const { data: imgs } = await supabase
            .from("wtn_document_images")
            .select("id, storage_path, sort_order")
            .in("document_id", docIds)
            .eq("kind", "photo")
            .order("sort_order");
          for (const img of imgs ?? []) {
            const { data } = await supabase.storage
              .from("wtn-documents")
              .createSignedUrl(img.storage_path, 60 * 60);
            if (data?.signedUrl) {
              collected.push({ id: img.id, url: data.signedUrl, label: "Ticket Photo" });
            }
          }
        }
      } catch {
        // Photos are a nice-to-have — never block the load report flow.
      }

      if (cancelled) return;
      setPhotos(collected);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [jobNumber]);

  if (!jobNumber?.trim()) return null;
  if (loading) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking job ticket for photos…
      </p>
    );
  }
  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" /> Job Ticket Photos
        <Badge variant="secondary" className="text-[10px]">{photos.length}</Badge>
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setLightbox(p.url)}
            className="shrink-0 text-left"
            title={p.label}
          >
            <img
              src={p.url}
              alt={p.label}
              loading="lazy"
              className="h-20 w-20 rounded-lg border object-cover"
            />
            <span className="block text-[10px] text-muted-foreground mt-0.5 w-20 truncate">
              {p.label}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl">
          {lightbox && <img src={lightbox} alt="Job ticket photo" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
