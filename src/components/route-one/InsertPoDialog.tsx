import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileText, FileUp, Loader2, RotateCcw } from "lucide-react";
import { PoReadResultView } from "@/components/po/PoReadResultView";
import { poToJobPrefill, type JobPrefill, type PoReadResult } from "@/lib/po-job-prefill";

const MAX_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/**
 * "Insert PO" in Route One's New Job window: staff upload a PO PDF (or paste the
 * order text), check what was read and its price/date flags, then fill the form.
 * Filling never saves, prices or dispatches the job.
 */
export function InsertPoDialog({ open, onOpenChange, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; onApply: (prefill: JobPrefill) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PoReadResult | null>(null);

  const reset = () => { setResult(null); setError(null); setText(""); if (fileRef.current) fileRef.current.value = ""; };
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next); };

  const read = async (body: Record<string, unknown>) => {
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await supabase.functions.invoke("crm-read-po", { body });
    setLoading(false);
    if (err || data?.error) { setError(typeof data?.error === "string" ? data.error : err?.message ?? "Could not read that PO"); return; }
    setResult(data as PoReadResult);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { setError("Choose a PDF file."); return; }
    if (file.size > MAX_BYTES) { setError("That PDF is over 10 MB."); return; }
    try { await read({ file: { name: file.name, data: await fileToBase64(file) } }); }
    catch (e) { setLoading(false); setError((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Insert PO</DialogTitle>
          <p className="text-sm text-muted-foreground">Read a purchase order and fill in this job. Nothing is saved until you press Save or Book.</p>
        </DialogHeader>

        {!result && !loading && (
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "file" | "text"); setError(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file"><FileUp className="h-4 w-4 mr-1.5" />Upload PDF</TabsTrigger>
              <TabsTrigger value="text"><FileText className="h-4 w-4 mr-1.5" />Paste text</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="pt-3">
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-8 text-center cursor-pointer hover:bg-muted/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]); }}
              >
                <FileUp className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">Choose or drop the PO PDF</span>
                <span className="text-xs text-muted-foreground">Up to 10 MB</span>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PO PDF" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
            </TabsContent>
            <TabsContent value="text" className="pt-3 space-y-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Paste the order from the email, e.g. YardLink orders" aria-label="PO text" />
              <Button className="w-full" disabled={!text.trim()} onClick={() => void read({ text: text.trim() })}>Read order</Button>
            </TabsContent>
          </Tabs>
        )}

        {loading && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Reading the purchase order…</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && <PoReadResultView result={result} />}

        {result && (
          <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
            <p className="mr-auto text-xs text-muted-foreground truncate">{result.attachment.file_name}</p>
            <Button variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4 mr-1.5" />Read another</Button>
            <Button onClick={() => { onApply(poToJobPrefill(result.po, result.account)); close(false); }}>Fill job</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
