import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Upload, FileText, Trash2, Download, Eye, Settings, Copy } from "lucide-react";
import { PodsSettingsDialog, type PodFolder } from "./PodsSettingsDialog";

type Pod = {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  job_number: string | null;
  customer: string | null;
  site: string | null;
  delivery_date: string | null;
  created_at: string;
};

interface Props {
  canManage: boolean;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Guess a job number from a filename like "JOB50099.pdf", "POD_12345.pdf" or "45123 - Acme.pdf"
function guessJobNumber(name: string): string | null {
  const base = name.replace(/\.pdf$/i, "");
  const job = base.match(/job[\s_\-#]*0*(\d{3,8})/i);
  if (job) return job[1];
  const m = base.match(/\b(\d{4,7})\b/);
  return m ? m[1] : null;
}

// Look up customer / site for a job number from the Data Hub
async function lookupJob(jobNumber: string | null) {
  if (!jobNumber) return { customer: null as string | null, site: null as string | null, delivery_date: null as string | null };
  const { data } = await supabase
    .from("data_hub_jobs")
    .select("customer, site, job_date")
    .eq("job_number", jobNumber)
    .order("job_date", { ascending: false })
    .limit(1);
  const row = data?.[0];
  return {
    customer: row?.customer ?? null,
    site: row?.site ?? null,
    delivery_date: row?.job_date ?? null,
  };
}

export const PodsPanel = ({ canManage }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<{ pod: Pod; url: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultFolder, setDefaultFolder] = useState<PodFolder | null>(null);

  const loadDefaultFolder = useCallback(async () => {
    const { data } = await supabase
      .from("pod_source_folders")
      .select("id, label, path, is_default")
      .eq("is_default", true)
      .limit(1);
    setDefaultFolder((data?.[0] as PodFolder) ?? null);
  }, []);

  useEffect(() => {
    void loadDefaultFolder();
  }, [loadDefaultFolder]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("pod_documents")
        .select("id, file_name, storage_path, file_size, job_number, customer, site, delivery_date, created_at")
        .order("created_at", { ascending: false })
        .limit(300);

      const term = search.trim();
      if (term) {
        q = q.or(`file_name.ilike.%${term}%,job_number.ilike.%${term}%,customer.ilike.%${term}%,site.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setPods((data ?? []) as Pod[]);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Could not load PODs", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUploadClick = async () => {
    // Chromium can open a folder picker directly. It remembers the last folder
    // used for this id, so after the first time it lands straight in the
    // default POD folder on the network drive.
    const picker = (window as any).showDirectoryPicker;
    const inIframe = window.self !== window.top;

    if (typeof picker === "function" && !inIframe) {
      try {
        const dir = await picker.call(window, {
          id: "pod-default-folder",
          mode: "read",
          startIn: "documents",
        });
        const files: File[] = [];
        for await (const [, handle] of (dir as any).entries()) {
          if (handle.kind === "file" && /\.pdf$/i.test(handle.name)) {
            files.push(await handle.getFile());
          }
        }
        if (files.length === 0) {
          toast({ title: "No PDFs found", description: "That folder has no PDF files." });
          return;
        }
        await handleUpload(files);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        // fall through to the classic file dialog
      }
    }

    if (inIframe) {
      toast({
        title: "Open the app in its own tab",
        description:
          "The folder picker is blocked inside the preview frame. Open the portal in a normal browser tab to pick the POD folder directly.",
      });
    }

    if (defaultFolder?.path) {
      try {
        await navigator.clipboard.writeText(defaultFolder.path);
        toast({
          title: "Default POD folder copied",
          description: `Paste ${defaultFolder.path} into the file dialog address bar.`,
        });
      } catch {
        toast({
          title: "Default POD folder",
          description: defaultFolder.path,
        });
      }
    }
    fileRef.current?.click();
  };


  const handleUpload = async (files: FileList | File[] | null) => {

    if (!files || files.length === 0 || !canManage) return;
    setUploading(true);
    let ok = 0;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      for (const file of Array.from(files)) {
        if (!/\.pdf$/i.test(file.name)) {
          toast({ title: "Skipped", description: `${file.name} is not a PDF.`, variant: "destructive" });
          continue;
        }
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("pods").upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (upErr) throw upErr;

        const jobNumber = guessJobNumber(file.name);
        const meta = await lookupJob(jobNumber);

        const { error: insErr } = await supabase.from("pod_documents").insert({
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          job_number: jobNumber,
          customer: meta.customer,
          site: meta.site,
          delivery_date: meta.delivery_date,
          uploaded_by: uid,
        });
        if (insErr) throw insErr;
        ok += 1;
      }
      if (ok > 0) toast({ title: "PODs uploaded", description: `${ok} file${ok === 1 ? "" : "s"} added.` });
      await load();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const signedUrl = async (pod: Pod) => {
    const { data, error } = await supabase.storage.from("pods").createSignedUrl(pod.storage_path, 60 * 10);
    if (error || !data?.signedUrl) throw error ?? new Error("Could not create link");
    return data.signedUrl;
  };

  const handleView = async (pod: Pod) => {
    try {
      const url = await signedUrl(pod);
      // Fetch as a blob so the PDF is same-origin — sandboxed/cross-origin PDF
      // embeds are blocked by Chrome inside the preview iframe.
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not download file");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      setViewing({ pod, url: objectUrl });
    } catch (e: any) {
      toast({ title: "Could not open POD", description: e?.message, variant: "destructive" });
    }
  };


  const handleDownload = async (pod: Pod) => {
    try {
      const url = await signedUrl(pod);
      const a = document.createElement("a");
      a.href = url;
      a.download = pod.file_name;
      a.target = "_blank";
      a.click();
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async (pod: Pod) => {
    if (!canManage) return;
    if (!confirm(`Delete POD "${pod.file_name}"?`)) return;
    try {
      await supabase.storage.from("pods").remove([pod.storage_path]);
      const { error } = await supabase.from("pod_documents").delete().eq("id", pod.id);
      if (error) throw error;
      setPods((prev) => prev.filter((p) => p.id !== pod.id));
      toast({ title: "POD deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Proof of Delivery (PODs)
              </CardTitle>
              <CardDescription>
                Upload signed POD PDFs for completed work. Click a row to view the document.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {defaultFolder && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground shrink-0">Default POD folder:</span>
              <span className="truncate font-mono text-xs">{defaultFolder.path}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto shrink-0"
                aria-label="Copy default POD folder path"
                onClick={() => void navigator.clipboard.writeText(defaultFolder.path)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search file, job number, customer, site…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button
              onClick={() => void handleUploadClick()}
              disabled={!canManage || uploading}
              className="gap-2 shrink-0"
            >
              <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
              {uploading ? "Uploading…" : "Upload PODs"}
            </Button>

          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canManage && !uploading) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!canManage || uploading) return;
              void handleUpload(e.dataTransfer.files);
            }}
            onClick={() => canManage && !uploading && fileRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drag and drop POD PDFs here or click to browse"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
            } ${canManage && !uploading ? "cursor-pointer hover:border-primary/50" : "cursor-not-allowed opacity-60"}`}
          >
            <Upload className={`h-6 w-6 text-muted-foreground ${uploading ? "animate-pulse" : ""}`} />
            <p className="text-sm font-medium">
              {uploading ? "Uploading…" : dragOver ? "Drop PDFs to upload" : "Drag & drop POD PDFs here"}
            </p>
            <p className="text-xs text-muted-foreground">
              {canManage ? "or click to browse — multiple PDF files supported" : "You don't have permission to upload PODs"}
            </p>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="whitespace-nowrap">Job #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="whitespace-nowrap">Uploaded</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Size</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : pods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      No PODs uploaded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  pods.map((pod) => (
                    <TableRow
                      key={pod.id}
                      className="cursor-pointer"
                      onClick={() => void handleView(pod)}
                    >
                      <TableCell className="max-w-[22rem] truncate" title={pod.file_name}>
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          {pod.file_name}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{pod.job_number ?? "—"}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-sm">{pod.customer ?? "—"}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-sm">{pod.site ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(pod.created_at).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-sm tabular-nums">
                        {formatSize(pod.file_size)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => void handleView(pod)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => void handleDownload(pod)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Delete"
                            disabled={!canManage}
                            onClick={() => void handleDelete(pod)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pods.length >= 300 && (
            <p className="text-xs text-muted-foreground">Showing latest 300. Refine your search to find older PODs.</p>
          )}
        </CardContent>
      </Card>

      <PodsSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        canManage={canManage}
        onSaved={() => void loadDefaultFolder()}
      />

      <Dialog

        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) {
            if (viewing?.url.startsWith("blob:")) URL.revokeObjectURL(viewing.url);
            setViewing(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{viewing?.pod.file_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <>
              <object data={viewing.url} type="application/pdf" className="flex-1 w-full rounded-md border border-border">
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  Your browser blocked the inline PDF preview. Use the button below to open it in a new tab.
                </div>
              </object>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => window.open(viewing.url, "_blank", "noopener")}>
                  Open in new tab
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
};
