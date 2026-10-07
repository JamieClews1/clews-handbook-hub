import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StatusPill, type BJob } from "./BanksmanWorkflow";
import { acknowledgeAlert } from "./useBanksmanJobs";
import { openBanksmanWtn } from "./banksmanWtn";
import { useWtnTemplate } from "@/components/weighone/WtnTemplateEditor";

const gbp = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—");

export function BanksmanJobDialog({ job, onClose }: { job: BJob | null; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: wtnTemplate } = useWtnTemplate();
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  if (!job) return null;

  const ack = async () => {
    if (!user) return;
    setBusy(true);
    try { await acknowledgeAlert(job.id, user.id); toast({ title: "Alert acknowledged" }); onClose(); }
    catch (e) { toast({ title: "Could not acknowledge", description: (e as Error).message, variant: "destructive" }); }
    setBusy(false);
  };

  const Gallery = ({ photos }: { photos: { url: string; taken_at: string }[] }) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {photos.map((p) => (
        <button key={p.url} onClick={() => setBig(p.url)} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
          <img src={p.url} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1 text-[11px]">{dt(p.taken_at)}</span>
        </button>
      ))}
      {photos.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No photos.</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl">Job #{job.job_number} <StatusPill job={job} /></DialogTitle>
        </DialogHeader>

        {job.alert_status === "urgent" && (
          <div className="flex items-center gap-3 rounded-lg bg-destructive p-4 text-destructive-foreground">
            <AlertTriangle className="h-8 w-8 shrink-0" />
            <div className="flex-1"><p className="text-xl font-extrabold">URGENT – CONTAMINATION</p><p>Review the photos and charge, then acknowledge.</p></div>
            <Button variant="secondary" size="lg" disabled={busy} onClick={ack} className="font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACKNOWLEDGE ALERT"}</Button>
          </div>
        )}
        {job.alert_status === "acknowledged" && (
          <div className="rounded-lg border-2 border-orange-500 p-3 text-sm"><b className="text-orange-600">ACKNOWLEDGED</b> by {job.acknowledged_by_name} · {dt((job as any).acknowledged_at)}</div>
        )}

        <div className="grid gap-x-6 gap-y-2 rounded-lg border border-border p-4 sm:grid-cols-2">
          {[["Registration", job.vehicle_reg], ["Customer", job.customer], ["Material", job.material], ["Container", job.container_type], ["Site", job.site],
            ["Banksman", job.completed_by_name], ["Completed", dt(job.completed_at)], ["Notes", job.notes]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{v}</span></div>
          ))}
        </div>

        {job.has_contamination && (
          <section className="space-y-3 rounded-lg border-2 border-destructive p-4">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-destructive"><AlertTriangle className="h-5 w-5" /> Contamination</h3>
            {job.contamination_items.map((i) => (
              <div key={i.item_id} className="flex justify-between"><span>{i.name}{i.qty > 1 ? ` × ${i.qty}` : ""}</span><b>{gbp(i.line_total)}</b></div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-lg font-extrabold"><span>Total Additional Charge</span><span className="text-destructive">{gbp(job.contamination_total)}</span></div>
            <p className="font-semibold">Contamination Photos</p>
            <Gallery photos={job.contamination_photos} />
          </section>
        )}
        {!job.has_contamination && job.status === "completed" && (
          <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> No contamination recorded</p>
        )}
        {job.status === "completed" && (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="gap-2 font-bold" onClick={() => openBanksmanWtn(job, wtnTemplate?.html, false)}>
              <FileText className="h-5 w-5" /> Ticket without prices
            </Button>
            <Button size="lg" variant="outline" className="gap-2 font-bold" onClick={() => openBanksmanWtn(job, wtnTemplate?.html, true)}>
              <FileText className="h-5 w-5" /> Ticket with prices
            </Button>
          </div>
        )}

        <section className="space-y-2">
          <h3 className="font-bold">Load Photos ({job.load_photos.length})</h3>
          <Gallery photos={job.load_photos} />
        </section>

        {big && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/90 p-4" onClick={() => setBig(null)}>
            <img src={big} alt="" className="max-h-full max-w-full rounded" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
