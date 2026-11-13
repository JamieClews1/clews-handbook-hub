import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  dedupeWasteOutProducts,
  rankWasteOutProducts,
  searchWasteOutProducts,
  wasteOutLoadsFor,
  WASTE_OUT_TOP_N,
} from "@/lib/waste-out-product-order";

export type WasteOutProductOption = {
  id: string;
  recorded_name: string;
  display_name: string;
  ewc_code: string | null;
  status: string;
};

type Props = {
  products: WasteOutProductOption[];
  value: string;
  onChange: (id: string, product: WasteOutProductOption) => void;
  placeholder?: string;
};

/** One box for Waste Out products: search inside the list, busiest products on top. */
export function WasteOutProductPicker({ products, value, onChange, placeholder = "Select waste type..." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const ranked = useMemo(() => rankWasteOutProducts(dedupeWasteOutProducts(products, value)), [products, value]);
  const shown = useMemo(() => searchWasteOutProducts(ranked, query), [ranked, query]);
  const selected = products.find(p => p.id === value) ?? null;
  const topIds = useMemo(() => new Set(ranked.slice(0, WASTE_OUT_TOP_N).map(p => p.id)), [ranked]);

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
          className={cn("h-9 w-full justify-between px-3 font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-mono text-xs mr-2">{selected.ewc_code}</span>
                {selected.display_name}
              </>
            ) : (
              placeholder
            )}
          </span>
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
            {shown.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No waste types match.</p>
            )}
            {shown.map((p, i) => {
              const showHeader = i === 0 || (topIds.has(p.id) !== topIds.has(shown[i - 1].id));
              const loads = wasteOutLoadsFor(p.recorded_name);
              return (
                <div key={p.id}>
                  {showHeader && (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {topIds.has(p.id) ? "Most common" : "All products"}
                    </p>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                    onClick={() => {
                      onChange(p.id, p);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", p.id === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs mr-2">{p.ewc_code}</span>
                      <span className="text-sm">{p.display_name}</span>
                    </span>
                    {topIds.has(p.id) && loads ? (
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
