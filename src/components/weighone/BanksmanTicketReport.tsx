import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BanksmanJobDialog } from "@/components/banksman/BanksmanJobDialog";
import type { BJob } from "@/components/banksman/BanksmanWorkflow";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";

export type LinkedBanksmanJob = BJob & { weighbridge_transaction_id?: string | null };

export function banksmanLabel(job: BJob | undefined) {
  if (!job || job.status === "new") return "Not checked yet";
  if (job.alert_status === "urgent") return "Urgent · review required";
  if (job.has_contamination) return "Contamination reported";
  return job.status === "completed" ? "Checked · clean load" : "Checking load";
}

export function BanksmanTicketReport({ job }: { job: LinkedBanksmanJob | undefined }) {
  const [open, setOpen] = useState(false);
  if (!job) return <p className="text-xs text-muted-foreground">Banksman · Not checked yet</p>;
  const photos = [...(job.contamination_photos || []), ...(job.load_photos || [])];
  return <section className="space-y-3 border-y border-border py-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Banksman report</h3><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Review <ChevronRight className="h-4 w-4" /></Button></div>
    <Badge variant="outline" className={job.alert_status === "urgent" ? "text-destructive border-destructive" : job.has_contamination ? "text-warning-text bg-warning-subtle" : "text-primary"}>{job.has_contamination ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}{banksmanLabel(job)}</Badge>
    <p className="text-xs text-muted-foreground">{job.completed_by_name || "Awaiting yard check"}{job.completed_at ? ` · ${new Date(job.completed_at).toLocaleString("en-GB")}` : ""}</p>
    {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.slice(0, 3).map((photo, index) => <Button key={`${photo.url}:${index}`} variant="ghost" onClick={() => setOpen(true)} className="h-auto aspect-square overflow-hidden border border-border p-0" aria-label={`Review Banksman photo ${index + 1}`}><img src={photo.url} alt="Banksman load evidence" className="h-full w-full object-cover" /></Button>)}</div>}
    {job.has_contamination && <div className="space-y-1 text-sm">{job.contamination_items.map(item => <div key={item.item_id} className="flex justify-between gap-2"><span>{item.name} × {item.qty}</span><strong>£{Number(item.line_total).toFixed(2)}</strong></div>)}<p className="text-xs text-muted-foreground">Reported charge · £{Number(job.contamination_total).toFixed(2)}</p></div>}
    {job.notes && <p className="text-sm whitespace-pre-wrap">{job.notes}</p>}
    <BanksmanJobDialog job={open ? job : null} onClose={() => setOpen(false)} />
  </section>;
}