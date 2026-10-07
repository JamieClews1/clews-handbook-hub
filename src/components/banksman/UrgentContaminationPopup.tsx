import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBanksmanJobs } from "./useBanksmanJobs";
import { BanksmanJobDialog } from "./BanksmanJobDialog";

const gbp = (n: number) => `£${Number(n || 0).toFixed(2)}`;

/** Pops up on every staff screen and stays until each urgent contamination is acknowledged. */
export function UrgentContaminationPopup() {
  const { jobs } = useBanksmanJobs();
  const [openId, setOpenId] = useState<string | null>(null);
  const urgent = jobs.filter((j) => j.alert_status === "urgent");
  const open = jobs.find((j) => j.id === openId) ?? null;
  if (open) return <BanksmanJobDialog job={open} onClose={() => setOpenId(null)} />;
  if (!urgent.length) return null;
  const j = urgent[0];
  return (
    <div role="alertdialog" aria-live="assertive" className="fixed bottom-4 right-4 z-[60] w-[min(26rem,calc(100vw-2rem))] animate-in slide-in-from-bottom rounded-xl border-4 border-destructive-foreground/30 bg-destructive p-4 text-destructive-foreground shadow-2xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-9 w-9 shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold">URGENT – CONTAMINATION</p>
          <p className="font-semibold">Job #{j.job_number} · {j.vehicle_reg || "No reg"}</p>
          <p className="truncate">{j.contamination_items.map((i) => i.name).join(" + ")}</p>
          <p>Additional charge: <b>{gbp(j.contamination_total)}</b></p>
          {urgent.length > 1 && <p className="mt-1 text-sm font-bold">+{urgent.length - 1} more waiting</p>}
        </div>
      </div>
      <Button variant="secondary" className="mt-3 w-full font-bold" onClick={() => setOpenId(j.id)}>VIEW JOB</Button>
    </div>
  );
}
