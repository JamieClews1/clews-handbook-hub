import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { lineSource, type ArisingsFigures, type ColasArisings, type ColasLine } from "@/lib/colas-report";
import { fmtGBP, fmtT } from "./useColasData";
import { Chip, ukDate } from "./ColasShared";

export interface ArisingsView {
  arisings: ColasArisings;
  /** Authoritative charges per group (Sage when imported, otherwise provisional Skiptrak charges). */
  hazardousCost: number;
  nonHazardousCost: number;
  provisional: boolean;
  title: string;
  note?: string;
  /** Collection lines behind the table, so a stream row can show where its weights came from. */
  lines?: ColasLine[];
}

const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const cellT = (n: number) => (n ? fmtT(n) : "–");

function RecycledBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-2 w-16 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
        <div className={cn("h-full rounded-full", value >= 95 ? "bg-primary" : value >= 75 ? "bg-warning" : "bg-destructive")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-14 text-right font-semibold">{pct(value)}</span>
    </div>
  );
}

function Figures({ f, charges, strong, muted }: { f: ArisingsFigures; charges: number; strong?: boolean; muted?: boolean }) {
  const td = cn("px-3 py-2.5 text-right tabular-nums whitespace-nowrap", muted && "text-muted-foreground", strong && "font-bold");
  return (
    <>
      <td className={td}>{muted ? "–" : fmtT(f.removed)}</td>
      <td className={td}>{muted ? "–" : cellT(f.recycled)}</td>
      <td className={td}>{muted ? "–" : cellT(f.rdf)}</td>
      <td className={td}>{muted ? "–" : cellT(f.landfill)}</td>
      <td className={td}>{pct(f.pctLandfill)}</td>
      <td className={td}><RecycledBar value={f.pctRecycled} /></td>
      <td className={td}>{charges ? fmtGBP(charges) : "–"}</td>
    </>
  );
}

/** Colas Rail's "breakdown of waste arisings" sheet, laid out like the original spreadsheet. */
export function ColasArisingsTable({ month, ytd }: { month: ArisingsView; ytd: ArisingsView }) {
  const [mode, setMode] = useState<"month" | "ytd">("month");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const v = mode === "month" ? month : ytd;
  const a = v.arisings;
  const head = "px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground align-bottom";
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
        <div>
          <h3 className="text-lg font-bold leading-tight">Colas Rail – breakdown of waste arisings</h3>
          <p className="text-sm opacity-90">{v.title}</p>
        </div>
        <ToggleGroup type="single" value={mode} onValueChange={(x) => x && setMode(x as "month" | "ytd")} className="rounded-md bg-background p-1" aria-label="Period">
          <ToggleGroupItem value="month" className="text-foreground">This month</ToggleGroupItem>
          <ToggleGroupItem value="ytd" className="text-foreground">Year to date</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-px border-b bg-border sm:grid-cols-4">
        {[
          ["Tonnes removed", `${fmtT(a.total.removed)} t`],
          ["% recycled", pct(a.total.pctRecycled)],
          ["% to landfill", pct(a.total.pctLandfill)],
          ["Charges (ex VAT)", `${fmtGBP(v.hazardousCost + v.nonHazardousCost)}${v.provisional ? " *" : ""}`],
        ].map(([k, val]) => (
          <div key={k} className="bg-card px-4 py-3">
            <div className="text-sm font-semibold text-muted-foreground">{k}</div>
            <div className="text-2xl font-bold tabular-nums">{val}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-base">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="w-[280px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground align-bottom">Waste stream</th>
              <th className={head}>Tonnes removed</th>
              <th className={head}>Recycled (t)</th>
              <th className={head}>RDF / energy recovery (t)</th>
              <th className={head}>Landfill (t)</th>
              <th className={head}>% to landfill</th>
              <th className={head}>% recycled</th>
              <th className={head}>Charges £</th>
            </tr>
          </thead>
          {a.groups.map(g => (
            <tbody key={g.label}>
              <tr className="border-b bg-primary/10">
                <td colSpan={8} className="px-3 py-2">
                  <span className="mr-2 font-bold text-primary">{g.label}</span>
                  {g.hazardous ? <Chip tone="bad">Consignment note required</Chip> : null}
                </td>
              </tr>
              {g.rows.map(r => {
                const empty = r.collections === 0;
                const isOpen = !empty && open.has(r.key);
                const rowLines = isOpen ? (v.lines ?? []).filter(l => l.stream === r.key).sort((x, y) => x.date.localeCompare(y.date) || x.reference.localeCompare(y.reference)) : [];
                return (
                  <Fragment key={r.key}>
                    <tr className={cn("border-b last:border-b", !empty && "cursor-pointer hover:bg-muted/40", isOpen && "bg-muted/40")} onClick={empty ? undefined : () => toggle(r.key)}>
                      <td className={cn("px-3 py-2.5", empty ? "text-muted-foreground" : "font-medium")}>
                        {empty ? <span className="pl-6">{r.label}</span> : (
                          <button type="button" className="flex items-start gap-1 text-left" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); toggle(r.key); }}>
                            <ChevronRight className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden />
                            <span>{r.label}<span className="ml-2 text-xs font-normal text-muted-foreground">{r.collections} collection{r.collections === 1 ? "" : "s"}</span></span>
                          </button>
                        )}
                        {r.missingWeights > 0 && <div className="pl-6 text-xs font-semibold text-destructive">{r.missingWeights} without a weight – not in the totals</div>}
                      </td>
                      <Figures f={r} charges={r.charges} muted={empty} />
                    </tr>
                    {isOpen && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={8} className="px-3 pb-3 pt-1">
                          <div className="ml-6 overflow-x-auto rounded-md border bg-card">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Brought in from</th><th className="px-3 py-2">Weighbridge ticket</th><th className="px-3 py-2 text-right">Tonnes</th><th className="px-3 py-2">Weight taken from</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowLines.map(l => {
                                  const src = lineSource(l);
                                  return (
                                    <tr key={l.id} className="border-b last:border-0">
                                      <td className="whitespace-nowrap px-3 py-2">{ukDate(l.date)}</td>
                                      <td className="px-3 py-2 font-medium">{src.source}</td>
                                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{src.tickets.length ? src.tickets.join(", ") : <span className="text-muted-foreground">{l.provider === "clews" || l.provider === "robert_hopkins" ? "Not recorded" : "—"}</span>}</td>
                                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{l.weight_t == null ? "–" : fmtT(l.weight_t)}</td>
                                      <td className={cn("px-3 py-2", l.needsWeight ? "font-semibold text-destructive" : "text-muted-foreground")}>{src.weightFrom}</td>
                                    </tr>
                                  );
                                })}
                                {rowLines.length === 0 && <tr><td colSpan={5} className="px-3 py-2 text-muted-foreground">No collection details available.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-b-2 border-border bg-muted/60">
                <td className="px-3 py-2.5 font-bold">Total {g.label.toLowerCase()}</td>
                <Figures f={g.total} charges={g.hazardous ? v.hazardousCost : v.nonHazardousCost} strong />
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="bg-primary/10">
              <td className="px-3 py-3 text-lg font-bold">Total waste</td>
              <Figures f={a.total} charges={v.hazardousCost + v.nonHazardousCost} strong />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-1 border-t px-4 py-3 text-sm text-muted-foreground">
        <p>Energy recovery (RDF) counts as recycled. Only landfill lowers the % recycled. Consignment notes: {a.consignmentNotes}.</p>
        <p>Stream charges are the charges recorded on each job. Group totals {v.provisional ? "are provisional (* Sage not imported yet – recorded job charges, ex VAT)" : "come from Sage, ex VAT"}.</p>
        <p>Click a waste stream to see each collection, the weighbridge ticket or Enva/B&amp;M/Fortress entry its weight came from. How each stream splits into recycled, energy recovery and landfill is set under Sources &amp; settings.</p>
        {v.note && <p>{v.note}</p>}
      </div>
    </section>
  );
}
