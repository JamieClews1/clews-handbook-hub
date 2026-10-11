import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { printMidweighTicket } from "@/lib/imported-ticket-print";

export function MidweighPrintButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return <Button variant="outline" size="sm" disabled={busy} className="gap-2" onClick={async e => {
    e.stopPropagation(); setBusy(true);
    try { await printMidweighTicket(id); }
    catch (error) { toast({ title: "Ticket could not be printed", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" }); }
    finally { setBusy(false); }
  }}><Printer className="h-4 w-4" />{busy ? "Opening…" : "Print ticket"}</Button>;
}