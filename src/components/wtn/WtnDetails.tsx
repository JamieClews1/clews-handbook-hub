import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { parseWtnDocuments, signedUrl, WtnDocument, WtnImage } from "./wtn-utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  doc: WtnDocument;
  onRefresh?: () => void;
}

/** "WTN Details": parsed names, signature images and extracted job photos. */
export const WtnDetails = ({ doc, onRefresh }: Props) => {
  const { toast } = useToast();
  const [images, setImages] = useState<WtnImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reparsing, setReparsing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("wtn_document_images")
        .select("id, document_id, storage_path, kind, width, height, sort_order")
        .eq("document_id", doc.id)
        .order("sort_order");
      const imgs = (data ?? []) as WtnImage[];
      setImages(imgs);

      const map: Record<string, string> = {};
      await Promise.all(
        [...imgs.map((i) => i.storage_path), doc.customer_signature_path, doc.driver_signature_path]
          .filter(Boolean)
          .map(async (p) => {
            const u = await signedUrl(p as string);
            if (u) map[p as string] = u;
          }),
      );
      setUrls(map);
      setPdfUrl(await signedUrl(doc.storage_path));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.parse_status]);

  const reparse = async () => {
    setReparsing(true);
    try {
      await parseWtnDocuments([doc.id]);
      toast({ title: "Re-parsed", description: "WTN details refreshed." });
      onRefresh?.();
      await load();
    } catch (e: any) {
      toast({ title: "Parse failed", description: e?.message, variant: "destructive" });
    } finally {
      setReparsing(false);
    }
  };

  const photos = images.filter((i) => i.kind === "photo");
  const customerSig = doc.customer_signature_path ? urls[doc.customer_signature_path] : null;
  const driverSig = doc.driver_signature_path ? urls[doc.driver_signature_path] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={doc.parse_status === "parsed" ? "default" : doc.parse_status === "error" ? "destructive" : "secondary"}>
          {doc.parse_status}
        </Badge>
        <Badge variant="outline">{doc.received_via === "email" ? "Received by email" : "Manual upload"}</Badge>
        {pdfUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4 mr-2" /> View PDF
            </a>
          </Button>
        )}
        {pdfUrl && (
          <Button size="sm" variant="ghost" asChild>
            <a href={pdfUrl} download={doc.file_name}>
              <Download className="h-4 w-4 mr-2" /> Download
            </a>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={reparse} disabled={reparsing}>
          {reparsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Re-parse
        </Button>
      </div>

      {doc.parse_error && <p className="text-sm text-destructive">{doc.parse_error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Customer</p>
          <p className="font-medium">{doc.customer_name ?? "—"}</p>
          {customerSig ? (
            <img src={customerSig} alt="Customer signature" className="h-20 w-auto max-w-full bg-white rounded border object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">No signature found</p>
          )}
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Driver</p>
          <p className="font-medium">{doc.driver_name ?? "—"}</p>
          {driverSig ? (
            <img src={driverSig} alt="Driver signature" className="h-20 w-auto max-w-full bg-white rounded border object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">No signature found</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase text-muted-foreground mb-2">Job photos ({photos.length})</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos extracted from this WTN.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightbox(urls[p.storage_path] ?? null)}
                className="aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {urls[p.storage_path] && (
                  <img src={urls[p.storage_path]} alt="WTN job photo" className="h-full w-full object-cover" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          {lightbox && <img src={lightbox} alt="WTN job photo" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
