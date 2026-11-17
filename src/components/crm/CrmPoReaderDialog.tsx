import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSearch, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PoReadResultView } from "@/components/po/PoReadResultView";
import { jobPrefillToParams, poToJobPrefill, type PoReadResult } from "@/lib/po-job-prefill";

/** Pop-up showing how the portal interpreted a purchase-order PDF, with flags. */
export function CrmPoReaderDialog({
  attachmentId,
  ticketId,
  open,
  onOpenChange,
}: {
  attachmentId: string | null;
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PoReadResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke("crm-read-po", {
        body: attachmentId ? { attachmentId } : { ticketId },
      });
      setLoading(false);
      if (error || data?.error) {
        setError(data?.error ?? error?.message ?? "Could not read that PO");
        return;
      }
      setResult(data as PoReadResult);
    })();
  }, [open, attachmentId, ticketId]);

  const createParams = result ? jobPrefillToParams(poToJobPrefill(result.po)).toString() : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" /> Read PO
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm">Reading the purchase order…</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {result && (
          <div className="space-y-4">
            <PoReadResultView result={result} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground truncate">{result.attachment.file_name}</p>
              <Button asChild size="sm">
                <Link to={`/route-one?${createParams}`}>
                  <Plus className="h-4 w-4" /> Create job in Route One
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
