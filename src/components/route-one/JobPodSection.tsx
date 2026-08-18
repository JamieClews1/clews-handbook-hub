import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobNumber?: string | null;
}

export function JobPodSection({ jobNumber }: Props) {
  const jn = (jobNumber || "").trim();

  const { data: pods = [], isLoading } = useQuery({
    queryKey: ["route-one-job-pods", jn],
    enabled: !!jn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pod_documents")
        .select("id, file_name, storage_path, delivery_date, created_at")
        .or(`job_number.eq.${jn},file_name.ilike.%${jn}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openPod = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from("pods").createSignedUrl(storagePath, 600);
    if (error || !data?.signedUrl) {
      toast.error("Could not open POD");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (!jn) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">Proof of Delivery</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pods.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">No POD uploaded for this job</p>
      ) : (
        <div className="space-y-1">
          {pods.map((pod: any) => (
            <div key={pod.id} className="flex items-center justify-between gap-2 rounded border border-border p-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs truncate">{pod.file_name}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => openPod(pod.storage_path)}>
                <ExternalLink className="h-3 w-3 mr-1.5" /> View
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
