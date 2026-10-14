import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBanksmanJobs } from "./useBanksmanJobs";
import { BanksmanJobDialog } from "./BanksmanJobDialog";

const gbp = (n: number) => `£${Number(n || 0).toFixed(2)}`;

/** Pops up on every staff screen and stays until each urgent contamination is acknowledged or dismissed. */
export function UrgentContaminationPopup({ tablet = false }: { tablet?: boolean }) {
  const { jobs } = useBanksmanJobs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const urgent = jobs.filter((j) => j.alert_status === "urgent" && !dismissed.has(j.id));
  const open = jobs.find((j) => j.id === openId) ?? null;
  if (open) return <BanksmanJobDialog job={open} onClose={() => setOpenId(null)} />;
  if (!urgent.length) return null;
  const j = urgent[0];
  return (
    <div role="alertdialog" aria-label="Urgent contamination" aria-live="assertive" className={`fixed z-[45] animate-in motion-reduce:animate-none slide-in-from-bottom rounded-lg border-4 border-destructive-foreground/30 bg-destructive p-5 text-destructive-foreground shadow-lg ${tablet ? "bottom-3 left-3 right-3 max-h-[65dvh] overflow-y-auto sm:left-auto sm:w-[min(36rem,calc(100vw-1.5rem))]" : "bottom-4 right-4 w-[min(26rem,calc(100vw-2rem))]"}`}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Dismiss urgent contamination alert"
        title="Dismiss (comes back if the job is still unacknowledged after a page reload)"
        onClick={() => setDismissed((prev) => new Set(prev).add(j.id))}
        className="absolute top-1 right-1 h-12 w-12 text-destructive-foreground hover:text-destructive-foreground hover:bg-destructive-foreground/10"
      >
        <X className="h-5 w-5" />
      </Button>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1 pr-7">
          <p className="text-xl font-extrabold">URGENT CONTAMINATION</p>
          <p className={tablet ? "mt-2 text-2xl font-bold" : "font-semibold"}>Job #{j.job_number} · {j.vehicle_reg || "No reg"}</p>
          <p className="font-semibold break-words">{j.customer}</p>
          <p className="break-words">{j.contamination_items.map((i) => i.name).join(" + ")}</p>
          <p>Additional charge: <b>{gbp(j.contamination_total)}</b></p>
          {urgent.length > 1 && <p className="mt-1 text-sm font-bold">+{urgent.length - 1} more waiting</p>}
        </div>
      </div>
      <Button variant="outline" className="mt-4 h-auto min-h-14 w-full whitespace-normal border-destructive-foreground bg-card text-card-foreground text-base font-bold hover:bg-card/90 hover:text-card-foreground" onClick={() => setOpenId(j.id)}>Review photos & charge</Button>
    </div>
  );
}
