import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Copy, Eye, FileText, Loader2, RefreshCw, Settings, Trash2, Upload } from "lucide-react";
import { formatSize, parseWtnDocuments, uploadWtnPdf, WTN_BUCKET, WTN_SELECT, WtnDocument } from "./wtn-utils";
import { WtnDetails } from "./WtnDetails";
import { PodsSettingsDialog, type PodFolder } from "@/components/data-uploads/PodsSettingsDialog";
import { pickPdfsFromRememberedFolder, clearFolderHandle } from "@/lib/folder-handle";
import { DEFAULT_PDA_UPLOAD_SETTINGS, fetchPdaUploadSettings, hasJobPrefix, type PdaUploadSettings } from "./pda-upload-settings";

interface Props {
  canManage?: boolean;
  /** Legacy: address Skiptrak used to email PDAs to. Uploads are now file-based. */
  inboundAddress?: string;
}

export const WtnDocumentsPanel = ({ canManage = true }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<WtnDocument[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<WtnDocument | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultFolder, setDefaultFolder] = useState<PodFolder | null>(null);
  const [rules, setRules] = useState<PdaUploadSettings>(DEFAULT_PDA_UPLOAD_SETTINGS);

  const loadRules = useCallback(async () => {
    setRules(await fetchPdaUploadSettings());
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

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
      let q = supabase.from("wtn_documents").select(WTN_SELECT).order("created_at", { ascending: false }).limit(300);
      const term = search.trim();
      if (term) {
        q = q.or(
          `file_name.ilike.%${term}%,job_number.ilike.%${term}%,customer.ilike.%${term}%,site.ilike.%${term}%,customer_name.ilike.%${term}%,driver_name.ilike.%${term}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      setDocs((data ?? []) as WtnDocument[]);
    } catch (e: any) {
      toast({ title: "Could not load WTN documents", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUploadClick = async () => {
    const picked = await pickPdfsFromRememberedFolder("pda-default-folder");
    if (picked) {
      if (picked.files.length === 0) {
        if (picked.folderName) toast({ title: "No PDFs found", description: `${picked.folderName} has no PDF files.` });
        return;
      }
      await handleUpload(picked.files);
      return;
    }

    if (window.self !== window.top) {
      toast({
        title: "Open the app in its own tab",
        description:
          "The folder picker is blocked inside the preview frame. Open the portal in a normal browser tab to pick the PDA folder once — it is then remembered.",
      });
    }

    if (defaultFolder?.path) {
      try {
        await navigator.clipboard.writeText(defaultFolder.path);
        toast({
          title: "Default folder copied",
          description: `Paste ${defaultFolder.path} into the file dialog address bar.`,
        });
      } catch {
        toast({ title: "Default folder", description: defaultFolder.path });
      }
    }
    fileRef.current?.click();
  };


  const handleUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || !canManage) return;
    setUploading(true);
    const ids: string[] = [];
    const current = await fetchPdaUploadSettings();
    setRules(current);
    let skippedPrefix = 0;
    try {
      for (const file of Array.from(files)) {
        if (!/\.pdf$/i.test(file.name)) {
          toast({ title: "Skipped", description: `${file.name} is not a PDF.`, variant: "destructive" });
          continue;
        }
        if (current.require_job_prefix && !hasJobPrefix(file.name)) {
          skippedPrefix += 1;
          continue;
        }
        ids.push(await uploadWtnPdf(file, current.replace_existing));
      }
      if (skippedPrefix) {
        toast({
          title: `${skippedPrefix} file(s) skipped`,
          description: 'Only files starting with "JOB" are uploaded (see Settings).',
        });
      }
      if (ids.length) {
        toast({ title: "Uploaded", description: `${ids.length} WTN document(s) uploaded — parsing…` });
        await parseWtnDocuments(ids);
      }
      await load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const processPending = async () => {
    setProcessing(true);
    try {
      const res: any = await parseWtnDocuments();
      toast({ title: "Processing complete", description: `${res?.processed ?? 0} document(s) processed.` });
      await load();
    } catch (e: any) {
      toast({ title: "Processing failed", description: e?.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const remove = async (doc: WtnDocument) => {
    if (!canManage) return;
    try {
      const { data: imgs } = await supabase.from("wtn_document_images").select("storage_path").eq("document_id", doc.id);
      const paths = [doc.storage_path, ...((imgs ?? []).map((i: any) => i.storage_path))];
      await supabase.storage.from(WTN_BUCKET).remove(paths);
      const { error } = await supabase.from("wtn_documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> WTN Documents
            </CardTitle>
            <CardDescription>
              Waste transfer notes / PDAs from Skiptrak — matched to jobs, parsed for names, signatures and photos.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={processPending} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Process pending
            </Button>
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await clearFolderHandle("pda-default-folder");
                    toast({ title: "Folder cleared", description: "You'll be asked to pick the PDA folder next upload." });
                  }}
                >
                  Change folder
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </Button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <Button size="sm" onClick={handleUploadClick} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload PDAs
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {defaultFolder?.path && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="flex-1">
              Default PDA folder: <strong className="font-mono">{defaultFolder.path}</strong>
              {defaultFolder.label ? ` (${defaultFolder.label})` : ""}. Click Upload PDAs and pick this folder — the
              browser remembers it next time.
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(defaultFolder.path);
                toast({ title: "Path copied" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleUpload(e.dataTransfer.files);
          }}
          className={`rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground ${dragOver ? "bg-muted" : ""}`}
        >
          Drag &amp; drop WTN PDFs here — the job number is read from the filename.
          {rules.require_job_prefix ? ' Only files starting with "JOB" are accepted.' : ""}
          {rules.replace_existing ? " Files with the same name replace the previous version." : ""}
        </div>

        <Input
          placeholder="Search job number, customer, site, driver or file name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Job Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading…" : "No WTN documents yet."}
                  </TableCell>
                </TableRow>
              )}
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-[240px] truncate" title={d.file_name}>
                    {d.file_name}
                    <span className="block text-xs text-muted-foreground">{formatSize(d.file_size)}</span>
                  </TableCell>
                  <TableCell>{d.job_number ?? <span className="text-destructive">unmatched</span>}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{d.customer ?? d.customer_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{d.site ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.job_date ? new Date(d.job_date).toLocaleDateString("en-GB") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        d.parse_status === "parsed" ? "default" : d.parse_status === "error" ? "destructive" : "secondary"
                      }
                    >
                      {d.parse_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.received_via === "email" ? "Email" : "Manual"}
                    <span className="block">{new Date(d.created_at).toLocaleDateString("en-GB")}</span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setViewing(d)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => remove(d)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>WTN Details — job {viewing?.job_number ?? "unmatched"}</DialogTitle>
            <DialogDescription>{viewing?.file_name}</DialogDescription>
          </DialogHeader>
          {viewing && <WtnDetails doc={viewing} onRefresh={load} />}
        </DialogContent>
      </Dialog>

      <PodsSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        canManage={canManage}
        showUploadRules
        title="PDA Settings"
        onSaved={() => {
          void loadDefaultFolder();
          void loadRules();
        }}
      />
    </Card>
  );
};
