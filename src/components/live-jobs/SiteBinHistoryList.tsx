import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEwc, standardWasteName } from "@/lib/waste-streams";
import { historyOrderNumber, historyStatus, jobWeightTonnes, type BinHistory, type HistoryJob, type HistoryOrder, type LinkedTicket } from "@/lib/site-history";

type Props = {
  bins: BinHistory[];
  today: string;
  linked: Map<string, LinkedTicket[]>;
  isOwn: (site: string, container: string) => boolean;
  dateLabel: (value: string | null) => string;
  onOpenJob: (job: HistoryJob) => void;
  defaultOpen?: boolean;
};

const PAGE = 50;
const tonnes = (t: number | null) => t == null ? "—" : `${t.toFixed(2)} t`;

/** Read-only list of bin positions; each expands to its complete chain of orders and tickets. */
export default function SiteBinHistoryList({ bins, today, linked, isOwn, dateLabel, onOpenJob, defaultOpen }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ? bins.map(b => b.key) : []));
  const [shown, setShown] = useState<Record<string, number>>({});
  const toggle = (key: string) => setOpen(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return <ul className="space-y-3">
    {bins.map(b => {
      const isOpen = open.has(b.key);
      const waste = b.waste ? standardWasteName(b.waste, b.ewc, { source: "skiptrak" }) : null;
      const limit = shown[b.key] ?? PAGE;
      const linkedCount = b.jobs.reduce((n, j) => n + (linked.get(j.job_number)?.length ?? 0), 0);
      return <li key={b.key} className="rounded-md border border-border bg-card">
        <button type="button" onClick={() => toggle(b.key)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left hover:bg-muted/50 rounded-md">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Package className="h-4 w-4 text-primary" />
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{b.onSite > 1 ? `${b.onSite} × ` : ""}{b.container}</span>
              {b.onSite > 0 ? <Badge>On site</Badge> : <Badge variant="outline">Cleared</Badge>}
              {b.onSite > 0 && <Badge variant="outline">{isOwn(b.site, b.container) ? "Own" : "Clews"}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{[waste || "Waste not recorded", formatEwc(b.ewc), b.site].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-sm text-right tabular-nums">
            <div><span className="font-semibold">{b.jobs.length}</span> orders{linkedCount > 0 && <> · <span className="font-semibold">{linkedCount}</span> tickets</>}</div>
            <div className="text-muted-foreground">{b.onSite > 0 && b.lastMoved ? `Last moved ${dateLabel(b.lastMoved.date)}` : `${dateLabel(b.firstDate)} – ${dateLabel(b.lastDate)}`}</div>
          </div>
        </button>
        {isOpen && <div className="border-t border-border px-2 pb-3 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Movement</TableHead><TableHead>Status</TableHead><TableHead>Job</TableHead><TableHead>Order no.</TableHead><TableHead>Weighbridge ticket</TableHead><TableHead className="text-right">Weight</TableHead><TableHead>Driver / vehicle</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {b.jobs.slice(0, limit).map(j => {
                const tickets = linked.get(j.job_number) ?? [];
                const ticketWeight = tickets.reduce((n, t) => n + (t.weight_kg ?? 0), 0);
                const weight = jobWeightTonnes(j) ?? (ticketWeight > 0 ? ticketWeight / 1000 : null);
                const status = historyStatus(j, today);
                return <TableRow key={j.id}>
                  <TableCell className="whitespace-nowrap">{dateLabel(j.job_date)}</TableCell>
                  <TableCell>{j.movement_type || "—"}</TableCell>
                  <TableCell><Badge variant={status === "Completed" ? "secondary" : "outline"}>{status}</Badge></TableCell>
                  <TableCell><Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenJob(j)}>#{j.job_number}</Button></TableCell>
                  <TableCell>{historyOrderNumber(j as HistoryJob & HistoryOrder) ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{tickets.length ? tickets.map(t => `#${t.job_number}`).join(", ") : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{tonnes(weight)}</TableCell>
                  <TableCell className="text-muted-foreground">{[j.driver, j.vehicle_registration].filter(Boolean).join(" · ") || "—"}</TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
          {limit < b.jobs.length && <Button variant="outline" size="sm" className="mt-2" onClick={() => setShown(s => ({ ...s, [b.key]: b.jobs.length }))}>Show all {b.jobs.length} orders</Button>}
        </div>}
      </li>;
    })}
  </ul>;
}
