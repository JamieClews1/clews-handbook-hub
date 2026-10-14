import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { downloadSkiptrakTicket, printSkiptrakTicket } from "@/lib/imported-ticket-print";

export function SkiptrakPrintButton({ id }: { id: string }) {
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const { toast } = useToast();
  const run = async (action: "print" | "download") => {
    setBusy(action);
    try {
      if (action === "print") await printSkiptrakTicket(id);
      else await downloadSkiptrakTicket(id);
    } catch (error) {
      toast({ title: "Ticket could not be generated", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={busy !== null} className="gap-2" onClick={e => { e.stopPropagation(); run("print"); }}>
        <Printer className="h-4 w-4" />{busy === "print" ? "Opening…" : "Print ticket"}
      </Button>
      <Button variant="outline" size="sm" disabled={busy !== null} className="gap-2" onClick={e => { e.stopPropagation(); run("download"); }}>
        <FileDown className="h-4 w-4" />{busy === "download" ? "Preparing…" : "Download ticket"}
      </Button>
    </div>
  );
}
