import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatEwc,
  pickableWasteStreams,
  resolveWasteStream,
  searchWasteStreams,
  type WasteStream,
} from "@/lib/waste-streams";

type Props = {
  value: string;
  ewc?: string | null;
  /** Waste Out bookings list the outgoing streams first. */
  outgoing?: boolean;
  /** Limit the list to one direction (e.g. weighbridge Waste In price lines). */
  only?: "incoming" | "outgoing";
  onChange: (stream: WasteStream) => void;
};

/** Booking waste choice from the agreed standard list; picking one also sets its EWC. */
export function WasteStreamPicker({ value, ewc, outgoing = false, only, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = useMemo(() => resolveWasteStream({ name: value, ewc, source: "route_one" }), [value, ewc]);
  const groups = useMemo(() => {
    const incoming = pickableWasteStreams("incoming", false);
    const out = pickableWasteStreams("outgoing", false);
    const list: { label: string; items: WasteStream[] }[] = outgoing
      ? [{ label: "Waste out", items: out }, { label: "Incoming", items: incoming }]
      : [{ label: "Incoming", items: incoming }, { label: "Waste out", items: out }];
    // Haulage Only is a job type, not a waste choice.
    const shown = only ? list.filter((g) => g.label === (only === "incoming" ? "Incoming" : "Waste out")) : list;
    return shown.map((g) => ({ ...g, items: searchWasteStreams(g.items, query) })).filter((g) => g.items.length);
  }, [outgoing, only, query]);
  const isStandard = !!current && current.name === value;

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Waste type" className={cn("h-9 w-full justify-between px-3 font-normal", !value && "text-muted-foreground")}>
            <span className="truncate">{value || "Select waste type..."}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
          <div className="border-b border-border p-2">
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search waste type or code..." className="h-8" />
          </div>
          <div className="max-h-72 overflow-y-auto overscroll-contain p-1" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            {groups.length === 0 && <p className="p-3 text-sm text-muted-foreground">No standard waste type matches.</p>}
            {groups.map((g) => (
              <div key={g.label} className="py-1">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
                {g.items.map((s) => (
                  <button
                    key={s.ref}
                    type="button"
                    onClick={() => { onChange(s); setOpen(false); setQuery(""); }}
                    className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent", current?.ref === s.ref && "bg-accent")}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", current?.ref === s.ref ? "opacity-100" : "opacity-0")} />
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{s.ewc ? formatEwc(s.ewc) : "—"}</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {value && !isStandard && (
        <p className="text-xs text-muted-foreground">
          {current ? <>Standard name: <span className="font-medium text-foreground">{current.name}</span> — pick it to update.</> : "Not on the standard list — pick a standard waste type."}
        </p>
      )}
    </div>
  );
}
