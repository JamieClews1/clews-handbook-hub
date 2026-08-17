import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseWtnDocuments, uploadWtnPdf, WTN_SELECT, WtnDocument } from "./wtn-utils";
import { WtnDetails } from "./WtnDetails";

interface Props {
  jobNumber: string | null | undefined;
  canManage?: boolean;
}

/** "Documents" tab for a job ticket: WTN PDFs attached to this job. */
export const JobWtnDocuments = ({ jobNumber, canManage = true }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<WtnDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!jobNumber) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("wtn_documents")
      .select(WTN_SELECT)
      .eq("job_number", String(jobNumber))
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setDocs((data ?? []) as WtnDocument[]);
    setLoading(false);
  }, [jobNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const f of Array.from(files)) {
        if (!/\.pdf$/i.test(f.name)) continue;
        ids.push(await uploadWtnPdf(f));
      }
      if (ids.length) {
        await parseWtnDocuments(ids);
        toast({ title: "Uploaded", description: `${ids.length} document(s) attached.` });
      }
      await load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${docs.length} WTN document${docs.length === 1 ? "" : "s"} for job ${jobNumber ?? "—"}`}
        </p>
        {canManage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload PDF
            </Button>
          </>
        )}
      </div>

      {!loading && docs.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No WTN documents attached to this job yet.
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        {docs.map((d) => (
          <AccordionItem key={d.id} value={d.id}>
            <AccordionTrigger className="text-left">
              <span className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0" />
                {d.file_name}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <WtnDetails doc={d} onRefresh={load} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
