import { useMemo, useState } from "react";
import { useEwcCodes } from "@/hooks/useCodeRegisters";
import { normaliseEwcCode } from "@/lib/code-registers";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import wasteOut from "@/data/midweigh-waste-out-types.json";
import { formatEwc } from "@/lib/waste-streams";
import { WasteRefChip } from "@/components/waste/WasteRefChip";
import { sortWasteTypeRows, wasteTypeReferenceRows, withAllAgreedStreams, type WasteTypeEwcRow, type WasteTypeSort } from "@/lib/waste-type-references";

const SORT_OPTIONS: { value: WasteTypeSort; label: string }[] = [
  { value: "tonnes", label: "Volume (tonnes)" },
  { value: "loads", label: "Loads" },
  { value: "ref", label: "Reference (A–Z)" },
  { value: "code", label: "Waste code (number)" },
];

const fmtT = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const REFERENCE_ROWS = withAllAgreedStreams(wasteTypeReferenceRows(wasteOut.rows as WasteTypeEwcRow[]));

export function CommonWasteTypesSection() {
  const { data: codes = [] } = useEwcCodes(true);
  const [sortBy, setSortBy] = useState<WasteTypeSort>("tonnes");
  const register = useMemo(() => new Map(codes.map(c => [c.code.replace(/[^0-9]/g, ""), c])), [codes]);
  const sorted = useMemo(() => sortWasteTypeRows(REFERENCE_ROWS, sortBy), [sortBy]);

  return <section className="space-y-3">
    <div>
      <h2 className="text-xl font-semibold">Waste Types</h2>
      <p className="text-sm text-muted-foreground">
        Waste Out loads from {fmtDate(wasteOut.from)} – {fmtDate(wasteOut.to)}: {wasteOut.loads.toLocaleString()} loads, {fmtT(wasteOut.tonnes)} tonnes, grouped by agreed product reference and ranked by volume. Every agreed code is listed; codes with no Waste Out loads in this period show at the bottom.
      </p>
    </div>
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-muted-foreground">Sorted by</span>
      <Select value={sortBy} onValueChange={v => setSortBy(v as WasteTypeSort)}>
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
          <th className="p-3 font-semibold whitespace-nowrap">Product reference</th>
          <th className="p-3 font-semibold">Waste type</th>
          <th className="p-3 font-semibold">Waste code</th>
          <th className="p-3 font-semibold">Main destinations</th>
          <th className="p-3 font-semibold text-right">Loads</th><th className="p-3 font-semibold text-right">Tonnes</th><th className="p-3 font-semibold text-right">Share</th>
        </tr></thead>
        <tbody className="divide-y divide-border">{sorted.map(r => <tr key={r.key} className="align-top hover:bg-muted/30">
          <td className="p-3 whitespace-nowrap">{r.ref ? <WasteRefChip refCode={r.ref} className="text-xs px-2 py-0.5" /> : <span className="text-muted-foreground">No agreed code</span>}</td>
          <td className="p-3 min-w-[200px]">
            <div className="font-medium">{r.name}</div>
            {r.products.length > 0 && <div className="mt-0.5 text-xs text-muted-foreground">
              Recorded as: {r.products.map(p => `${p.name} (${p.loads})`).join(", ")}
            </div>}
          </td>
          <td className="p-3 min-w-[200px]">{r.ewcs.map(e => {
            const reg = register.get(e.ewc.replace(/[^0-9]/g, ""));
            return <div key={e.ewc}>
              <span className="font-mono font-medium whitespace-nowrap">{formatEwc(normaliseEwcCode(e.ewc))}</span>
              {reg?.hazardous && <Badge variant="destructive" className="ml-1">Hazardous</Badge>}
              <div className="text-xs text-muted-foreground">{reg?.description ?? e.description}</div>
            </div>;
          })}</td>
          <td className="p-3 text-muted-foreground min-w-[200px]">{r.loads === 0 && <div className="text-xs italic">No Waste Out loads in this period</div>}{r.ewcs.map(e => <div key={e.ewc}>
            {e.shared && <div className="text-xs italic">All {formatEwc(normaliseEwcCode(e.ewc))} loads (shared code)</div>}
            {e.destinations.map(p => <div key={p.name}>{p.name} <span className="tabular-nums">· {fmtT(p.tonnes)}t</span></div>)}
          </div>)}</td>
          <td className="p-3 text-right tabular-nums font-semibold">{r.loads ? r.loads.toLocaleString() : "—"}</td>
          <td className="p-3 text-right tabular-nums">{r.loads ? fmtT(r.tonnes) : "—"}</td>
          <td className="p-3 text-right tabular-nums">{r.loads ? `${((r.tonnes / wasteOut.tonnes) * 100).toFixed(1)}%` : "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
