import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Upload, FileText, Trash2, Download, Eye } from "lucide-react";

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

// Guess a job number from a filename like "POD_12345.pdf" or "45123 - Acme.pdf"
function guessJobNumber(name: string): string | null {
  const m = name.replace(/\.pdf$/i, "").match(/\b(\d{4,7})\b/);
  return m ? m[1] : null;
}

export const PodsPanel = ({ canManage }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<{ pod: Pod; url: string } | null>(null);

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

  const handleUpload = async (files: FileList | null) => {
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

        const { error: insErr } = await supabase.from("pod_documents").insert({
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          job_number: guessJobNumber(file.name),
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
      setViewing({ pod, url: await signedUrl(pod) });
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
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onClick={() => fileRef.current?.click()}
              disabled={!canManage || uploading}
              className="gap-2 shrink-0"
            >
              <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
              {uploading ? "Uploading…" : "Upload PODs"}
            </Button>
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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{viewing?.pod.file_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <iframe src={viewing.url} title={viewing.pod.file_name} className="flex-1 w-full rounded-md border border-border" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
