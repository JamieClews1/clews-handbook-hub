import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobNumber?: string | null;
}

type DocRow = {
  id: string;
  file_name: string;
  storage_path: string;
  bucket: string;
  origin: "POD" | "WTN";
  created_at: string;
};

export function JobPodSection({ jobNumber }: Props) {
  const jn = (jobNumber || "").trim();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["route-one-job-pods", jn],
    enabled: !!jn,
    queryFn: async (): Promise<DocRow[]> => {
      const [podRes, wtnRes] = await Promise.all([
        supabase
          .from("pod_documents")
          .select("id, file_name, storage_path, created_at")
          .or(`job_number.eq.${jn},file_name.ilike.%${jn}%`)
          .order("created_at", { ascending: false }),
        supabase
          .from("wtn_documents")
          .select("id, file_name, storage_path, created_at")
          .or(`job_number.eq.${jn},file_name.ilike.%${jn}%`)
          .order("created_at", { ascending: false }),
      ]);
      if (podRes.error) throw podRes.error;
      if (wtnRes.error) throw wtnRes.error;

      const rows: DocRow[] = [
        ...(podRes.data ?? []).map((d: any) => ({ ...d, bucket: "pods", origin: "POD" as const })),
        ...(wtnRes.data ?? []).map((d: any) => ({ ...d, bucket: "wtn-documents", origin: "WTN" as const })),
      ];

      // de-dupe identical filenames across the two banks
      const seen = new Set<string>();
      return rows.filter((r) => {
        const key = (r.file_name || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const openDoc = async (doc: DocRow) => {
    const { data, error } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (!jn) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">Proof of Delivery / Waste Transfer Note</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">No POD or WTN document for this job</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={`${doc.origin}-${doc.id}`} className="flex items-center justify-between gap-2 rounded border border-border p-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs truncate">{doc.file_name}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">{doc.origin}</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={() => openDoc(doc)}>
                <ExternalLink className="h-3 w-3 mr-1.5" /> View
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
