import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { WasteRefChip } from "@/components/waste/WasteRefChip";
import { WASTE_STREAMS, WASTE_STREAM_STANDARD_VERSION, formatEwc, isHazardousEwc, searchWasteStreams } from "@/lib/waste-streams";

const DIRECTION_LABEL = { incoming: "Incoming", outgoing: "Waste out", job_type: "Job type (no waste)" } as const;

/** Read-only view of the agreed waste list: reference code, standard name and EWC for every stream. */
export function AgreedWasteListSection() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => searchWasteStreams(WASTE_STREAMS, q), [q]);
  const groups = (["incoming", "outgoing", "job_type"] as const)
    .map((d) => ({ d, items: rows.filter((s) => s.direction === d) }))
    .filter((g) => g.items.length);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">Agreed Waste List</h2>
        <p className="text-sm text-muted-foreground">
          Every agreed waste stream with its reference code, standard name and EWC — standard list {WASTE_STREAM_STANDARD_VERSION}. Route One, WeighOne, pricing and Duty of Care all choose from this list.
        </p>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, EWC or old wording" className="max-w-sm" aria-label="Search agreed waste list" />
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-3 font-semibold w-32">Reference</th><th className="p-3 font-semibold">Standard name</th><th className="p-3 font-semibold w-32">EWC</th></tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.d} className="divide-y divide-border">
              <tr className="bg-muted/30"><td colSpan={3} className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{DIRECTION_LABEL[g.d]} · {g.items.length}</td></tr>
              {g.items.map((s) => (
                <tr key={s.ref}>
                  <td className="p-3"><WasteRefChip refCode={s.ref} /></td>
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className={`p-3 font-mono whitespace-nowrap ${isHazardousEwc(s.ewc) ? "text-destructive" : ""}`}>{s.ewc ? formatEwc(s.ewc) : "—"}</td>
                </tr>
              ))}
            </tbody>
          ))}
          {groups.length === 0 && <tbody><tr><td colSpan={3} className="p-3 text-muted-foreground">No agreed waste matches.</td></tr></tbody>}
        </table>
      </div>
    </section>
  );
}
