import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl, WTN_SELECT, WtnDocument, WtnImage } from "./wtn-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText } from "lucide-react";

/**
 * Compact read-only view of the signatures (and photos) parsed from the PDA
 * waste transfer note for a job — shown inside job ticket dialogs.
 */
export const WtnJobSignatures = ({ jobNumber }: { jobNumber: string | null | undefined }) => {
  const [docs, setDocs] = useState<WtnDocument[]>([]);
  const [photos, setPhotos] = useState<WtnImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!jobNumber) {
        setDocs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("wtn_documents")
        .select(WTN_SELECT)
        .eq("job_number", String(jobNumber))
        .order("created_at", { ascending: false });
      const list = (data ?? []) as WtnDocument[];
      const { data: imgs } = await supabase
        .from("wtn_document_images")
        .select("id, document_id, storage_path, kind, width, height, sort_order")
        .in("document_id", list.map((d) => d.id).length ? list.map((d) => d.id) : ["00000000-0000-0000-0000-000000000000"])
        .eq("kind", "photo")
        .order("sort_order");
      const photoList = (imgs ?? []) as WtnImage[];

      const map: Record<string, string> = {};
      await Promise.all(
        [
          ...list.flatMap((d) => [d.customer_signature_path, d.driver_signature_path]),
          ...photoList.map((p) => p.storage_path),
        ]
          .filter(Boolean)
          .map(async (p) => {
            const u = await signedUrl(p as string);
            if (u) map[p as string] = u;
          }),
      );
      const pdfs: Record<string, string> = {};
      await Promise.all(
        list.map(async (d) => {
          const u = await signedUrl(d.storage_path);
          if (u) pdfs[d.id] = u;
        }),
      );
      if (cancelled) return;
      setDocs(list);
      setPhotos(photoList);
      setUrls(map);
      setPdfUrls(pdfs);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobNumber]);

  if (!jobNumber) return null;
  if (loading) return <p className="text-xs text-muted-foreground">Loading WTN signatures…</p>;
  if (docs.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Signed WTN (PDA)</p>
      {docs.map((d) => {
        const cust = d.customer_signature_path ? urls[d.customer_signature_path] : null;
        const drv = d.driver_signature_path ? urls[d.driver_signature_path] : null;
        const docPhotos = photos.filter((p) => p.document_id === d.id);
        return (
          <div key={d.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">{d.file_name}</p>
              {pdfUrls[d.id] && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={pdfUrls[d.id]} target="_blank" rel="noreferrer">
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
                  </a>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Customer{d.customer_name ? ` — ${d.customer_name}` : ""}
                </p>
                {cust ? (
                  <img src={cust} alt="Customer signature" className="h-14 w-full rounded border bg-white object-contain" />
                ) : (
                  <p className="text-xs text-muted-foreground">No signature</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Driver{d.driver_name ? ` — ${d.driver_name}` : ""}
                </p>
                {drv ? (
                  <img src={drv} alt="Driver signature" className="h-14 w-full rounded border bg-white object-contain" />
                ) : (
                  <p className="text-xs text-muted-foreground">No signature</p>
                )}
              </div>
            </div>
            {docPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {docPhotos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox(urls[p.storage_path] ?? null)}
                    className="aspect-square overflow-hidden rounded border bg-muted"
                  >
                    {urls[p.storage_path] && (
                      <img src={urls[p.storage_path]} alt="WTN photo" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          {lightbox && <img src={lightbox} alt="WTN photo" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
