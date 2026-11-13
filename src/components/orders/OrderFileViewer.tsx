import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2 } from "lucide-react";

export type OrderFileToView = { name: string; load: () => Promise<Blob> };

function mimeFor(name: string, fallback: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return fallback || "application/octet-stream";
}

/**
 * Shows an order attachment inside the portal. The file is fetched as data and shown from a
 * local link, so browsers/extensions that block the storage web address can't stop it opening.
 */
export function OrderFileViewer({ file, onClose }: { file: OrderFileToView | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    file
      .load()
      .then((blob) => {
        if (cancelled) return;
        const mime = mimeFor(file.name, blob.type);
        objectUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
        setType(mime);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError("Could not load this file. Please try again."));
    return () => {
      cancelled = true;
      if (objectUrl) {
        const u = objectUrl;
        setTimeout(() => URL.revokeObjectURL(u), 30_000);
      }
    };
  }, [file]);

  const isPdf = type === "application/pdf";
  const isImage = type.startsWith("image/");

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{file?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" disabled={!url}>
            <a href={url ?? undefined} download={file?.name} aria-disabled={!url}>
              <Download className="mr-1.5 h-4 w-4" /> Download
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost" disabled={!url}>
            <a href={url ?? undefined} target="_blank" rel="noopener" aria-disabled={!url}>
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open in new tab
            </a>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : !url ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading file…
            </div>
          ) : isPdf ? (
            <iframe src={url} title={file?.name} className="h-full w-full" />
          ) : isImage ? (
            <img src={url} alt={file?.name} className="mx-auto max-h-full object-contain" />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">This file can't be previewed here — use Download.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
