import { useMemo, useState } from "react";
import { useEwcCodes } from "@/hooks/useCodeRegisters";
import { normaliseEwcCode } from "@/lib/code-registers";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import wasteOut from "@/data/midweigh-waste-out-types.json";

type Part = { name: string; loads: number; tonnes: number };
type Row = { ewc: string; description: string; loads: number; tonnes: number; products: Part[]; destinations: Part[] };
type SortKey = "code" | "loads" | "tonnes" | "share";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "code", label: "Waste code (number)" },
  { value: "tonnes", label: "Tonnes" },
  { value: "loads", label: "Loads" },
  { value: "share", label: "Share of total" },
];

const fmtT = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const ewcNumber = (ewc: string) => Number(ewc.replace(/[^0-9]/g, ""));

export function CommonWasteTypesSection() {
  const { data: codes = [] } = useEwcCodes(true);
  const [sortBy, setSortBy] = useState<SortKey>("code");
  const register = useMemo(() => new Map(codes.map(c => [c.code.replace(/[^0-9]/g, ""), c])), [codes]);
  const sorted = useMemo(() => {
    const rows = [...(wasteOut.rows as Row[])];
    rows.sort((a, b) => {
      if (sortBy === "code") return ewcNumber(a.ewc) - ewcNumber(b.ewc);
      if (sortBy === "loads") return b.loads - a.loads;
      if (sortBy === "tonnes") return b.tonnes - a.tonnes;
      return b.tonnes / wasteOut.tonnes - a.tonnes / wasteOut.tonnes;
    });
    return rows;
  }, [sortBy]);

  return <section className="space-y-3">
    <div>
      <h2 className="text-xl font-semibold">Most common waste types · Waste Out</h2>
      <p className="text-sm text-muted-foreground">
        From the Midweigh export, {fmtDate(wasteOut.from)} – {fmtDate(wasteOut.to)}: {wasteOut.loads.toLocaleString()} Waste Out loads, {fmtT(wasteOut.tonnes)} tonnes, grouped by EWC code.
      </p>
    </div>
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-muted-foreground">Sorted by</span>
      <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
        <SelectTrigger className="w-[220px]" aria-label="Sort waste types by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-3 font-semibold">EWC code</th><th className="p-3 font-semibold">Register description</th>
          <th className="p-3 font-semibold">Products</th><th className="p-3 font-semibold">Main destinations</th>
          <th className="p-3 font-semibold text-right">Loads</th><th className="p-3 font-semibold text-right">Tonnes</th><th className="p-3 font-semibold text-right">Share</th>
        </tr></thead>
        <tbody className="divide-y divide-border">{sorted.map(r => {
          const reg = register.get(r.ewc.replace(/[^0-9]/g, ""));
          return <tr key={r.ewc} className="align-top hover:bg-muted/30">
            <td className="p-3 font-mono font-medium whitespace-nowrap">{normaliseEwcCode(r.ewc)}</td>
            <td className="p-3 min-w-[200px]">{reg ? <span>{reg.description} {reg.hazardous && <Badge variant="destructive" className="ml-1">Hazardous</Badge>}</span> : <span className="text-muted-foreground">{r.description}</span>}</td>
            <td className="p-3 text-muted-foreground min-w-[180px]">{r.products.map(p => <div key={p.name}>{p.name} <span className="tabular-nums">({p.loads})</span></div>)}</td>
            <td className="p-3 text-muted-foreground min-w-[200px]">{r.destinations.map(p => <div key={p.name}>{p.name} <span className="tabular-nums">· {fmtT(p.tonnes)}t</span></div>)}</td>
            <td className="p-3 text-right tabular-nums font-semibold">{r.loads.toLocaleString()}</td>
            <td className="p-3 text-right tabular-nums">{fmtT(r.tonnes)}</td>
            <td className="p-3 text-right tabular-nums">{((r.tonnes / wasteOut.tonnes) * 100).toFixed(1)}%</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
