import { useMemo, useState } from "react";
import { WasteRefFor } from "@/components/waste/WasteRefChip";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  dedupeWasteInTypes,
  rankWasteInTypes,
  searchWasteInTypes,
  wasteInLoadsFor,
  WASTE_IN_TOP_N,
} from "@/lib/waste-in-type-order";

export type WasteInTypeOption = {
  id: string;
  waste_type: string;
  ewc_code: string | null;
};

type Props = {
  types: WasteInTypeOption[];
  value: string;
  onChange: (id: string, type: WasteInTypeOption | null) => void;
  /** Waste description carried in from a booking when no rate-card type matches it. */
  bookedWaste?: string | null;
  placeholder?: string;
  /** Waste type ids priced in the chosen rate group; preferred when the list has duplicates. */
  pricedIds?: ReadonlySet<string>;
};

/** One box for Waste In types: search inside the list, most common types on top. */
export function WasteInTypePicker({ types, value, onChange, bookedWaste, placeholder = "Select waste type...", pricedIds }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const ranked = useMemo(() => rankWasteInTypes(dedupeWasteInTypes(types, value, pricedIds)), [types, value, pricedIds]);
  const shown = useMemo(() => searchWasteInTypes(ranked, query), [ranked, query]);
  const selected = types.find(t => t.id === value) ?? null;
  const topIds = useMemo(() => new Set(ranked.slice(0, WASTE_IN_TOP_N).map(t => t.id)), [ranked]);
  const label = selected
    ? <><WasteRefFor name={selected.waste_type} ewc={selected.ewc_code} source="weighone" direction="incoming" className="mr-2" /><span className="font-mono text-xs mr-2">{selected.ewc_code}</span>{selected.waste_type}</>
    : bookedWaste ? <span className="italic">{bookedWaste}</span> : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Waste type"
          className={cn("h-9 w-full justify-between px-3 font-normal", !selected && !bookedWaste && "text-muted-foreground")}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search waste type or code..."
            className="h-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          <div className="p-1">
            {bookedWaste && !selected && (
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 opacity-100" />
                <span className="min-w-0 flex-1">
                  <span className="text-sm italic">{bookedWaste}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">from the booking</span>
                </span>
              </button>
            )}
            {shown.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No waste types match.</p>
            )}
            {shown.map((t, i) => {
              const showHeader = i === 0 || (topIds.has(t.id) !== topIds.has(shown[i - 1].id));
              const loads = wasteInLoadsFor(t.waste_type, t.ewc_code);
              return (
                <div key={t.id}>
                  {showHeader && (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {topIds.has(t.id) ? "Most common" : "All waste types"}
                    </p>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                    onClick={() => {
                      onChange(t.id, t);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", t.id === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <WasteRefFor name={t.waste_type} ewc={t.ewc_code} source="weighone" direction="incoming" className="mr-2" />
                      <span className="font-mono text-xs mr-2">{t.ewc_code}</span>
                      <span className="text-sm">{t.waste_type}</span>
                    </span>
                    {topIds.has(t.id) && loads ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{loads} {loads === 1 ? "load" : "loads"}</span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
