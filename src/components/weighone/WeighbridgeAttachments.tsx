import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const WEIGHBRIDGE_ATTACHMENTS_BUCKET = "weighbridge-attachments";

export type StagedAttachment = { file: File; kind: "photo" | "document" };

export type WeighbridgeAttachment = {
  id: string;
  transaction_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  file_size: number | null;
  kind: string;
  uploaded_by_name: string | null;
  created_at: string;
};

const isImage = (a: { content_type?: string | null; file_name: string }) =>
  (a.content_type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(a.file_name);

/** Upload a batch of files to storage and record them against a transaction. */
export async function uploadWeighbridgeAttachments(
  transactionId: string,
  files: StagedAttachment[],
  uploaderName?: string | null,
) {
  if (!files.length) return;
  const { data: auth } = await supabase.auth.getUser();
  const rows: Record<string, unknown>[] = [];

  for (const { file, kind } of files) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${transactionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await supabase.storage
      .from(WEIGHBRIDGE_ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;
    rows.push({
      transaction_id: transactionId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      file_size: file.size,
      kind,
      uploaded_by: auth.user?.id ?? null,
      uploaded_by_name:
        uploaderName ?? (auth.user?.user_metadata?.full_name as string | undefined) ?? auth.user?.email ?? null,
    });
  }

  const { error } = await (supabase.from("weighbridge_attachments" as never) as any).insert(rows);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Staged picker — used before the transaction exists                  */
/* ------------------------------------------------------------------ */

export const StagedAttachmentPicker = ({
  value,
  onChange,
}: {
  value: StagedAttachment[];
  onChange: (next: StagedAttachment[]) => void;
}) => {
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null, kind: StagedAttachment["kind"]) => {
    if (!files?.length) return;
    onChange([...value, ...Array.from(files).map((file) => ({ file, kind }))]);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => photoRef.current?.click()}>
          <Camera className="h-3.5 w-3.5" /> Photo
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => docRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Scanned doc
        </Button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files, "photo");
            e.target.value = "";
          }}
        />
        <input
          ref={docRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files, "document");
            e.target.value = "";
          }}
        />
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Attach scanned paperwork or photos from the driver / yard app. They upload when the weigh is saved.
        </p>
      ) : (
        <ul className="space-y-1">
          {value.map((s, i) => (
            <li key={`${s.file.name}-${i}`} className="flex items-center gap-2 text-xs rounded border border-border px-2 py-1">
              {s.kind === "photo" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate flex-1">{s.file.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Live attachments for an existing transaction                        */
/* ------------------------------------------------------------------ */

export const WeighbridgeAttachments = ({ transactionId }: { transactionId: string }) => {
  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["weighbridge-attachments", transactionId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("weighbridge_attachments" as never) as any)
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WeighbridgeAttachment[];
    },
    enabled: !!transactionId,
  });

  const { data: urls = {} } = useQuery({
    queryKey: ["weighbridge-attachment-urls", transactionId, attachments.map((a) => a.id).join(",")],
    queryFn: async () => {
      if (!attachments.length) return {};
      const { data } = await supabase.storage
        .from(WEIGHBRIDGE_ATTACHMENTS_BUCKET)
        .createSignedUrls(attachments.map((a) => a.storage_path), 3600);
      const map: Record<string, string> = {};
      (data ?? []).forEach((d, i) => {
        if (d.signedUrl) map[attachments[i].id] = d.signedUrl;
      });
      return map;
    },
    enabled: attachments.length > 0,
  });

  const upload = async (files: FileList | null, kind: StagedAttachment["kind"]) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await uploadWeighbridgeAttachments(transactionId, Array.from(files).map((file) => ({ file, kind })));
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
      qc.invalidateQueries({ queryKey: ["weighbridge-attachments", transactionId] });
    } catch (e) {
      toast.error("Upload failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeMutation = useMutation({
    mutationFn: async (a: WeighbridgeAttachment) => {
      await supabase.storage.from(WEIGHBRIDGE_ATTACHMENTS_BUCKET).remove([a.storage_path]);
      const { error } = await (supabase.from("weighbridge_attachments" as never) as any).delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attachment removed");
      qc.invalidateQueries({ queryKey: ["weighbridge-attachments", transactionId] });
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });

  const photos = attachments.filter(isImage);
  const docs = attachments.filter((a) => !isImage(a));

  return (
    <div className="rounded-lg border border-foreground/20 overflow-hidden bg-card">
      <div className="bg-muted px-3 py-2 border-b border-foreground/15 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Documents & Photos
        </span>
        <Badge variant="outline" className="text-[10px]">{attachments.length}</Badge>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => photoRef.current?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Photo
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => docRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Scanned doc
          </Button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              upload(e.target.files, "photo");
              e.target.value = "";
            }}
          />
          <input
            ref={docRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              upload(e.target.files, "document");
              e.target.value = "";
            }}
          />
        </div>

        {attachments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No scanned documents or photos attached to this ticket yet.
          </p>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((a) => (
              <div key={a.id} className="relative group rounded-md overflow-hidden border border-border">
                <a href={urls[a.id]} target="_blank" rel="noopener noreferrer">
                  {urls[a.id] ? (
                    <img src={urls[a.id]} alt={a.file_name} className="h-24 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-24 w-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </a>
                <button
                  className="absolute top-1 right-1 rounded bg-background/90 p-1 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => removeMutation.mutate(a)}
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
                <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">
                  {format(new Date(a.created_at), "dd/MM HH:mm")}
                </div>
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <ul className="space-y-1">
            {docs.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-xs rounded border border-border px-2 py-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={urls[a.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate flex-1 hover:underline"
                >
                  {a.file_name}
                </a>
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                </span>
                <button className="text-muted-foreground hover:text-destructive" onClick={() => removeMutation.mutate(a)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
