import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { containerChipLabel, type ContainerGroup } from "@/lib/weighone-container-groups";

type Props = {
  groups: ContainerGroup[];
  /** The stored container description, e.g. "SKIP · 8 yd" or "Van". */
  value: string | null | undefined;
  openGroup: string | null;
  onOpenGroup: (vehicle: string | null) => void;
  onSelect: (option: string, vehicle: string) => void;
  /** Optional "Other vehicle type" row for anything the picker does not list. */
  other?: {
    open: boolean;
    onOpen: () => void;
    label?: string;
    children?: ReactNode;
  };
};

type Row = { kind: "single"; groups: ContainerGroup[] } | { kind: "multi"; group: ContainerGroup };

/** Keep the picker's order, but run single-choice vehicles side by side so the form still fits. */
function toRows(groups: ContainerGroup[]): Row[] {
  const rows: Row[] = [];
  for (const g of groups) {
    if (g.options.length === 1) {
      const last = rows[rows.length - 1];
      if (last?.kind === "single") last.groups.push(g);
      else rows.push({ kind: "single", groups: [g] });
    } else {
      rows.push({ kind: "multi", group: g });
    }
  }
  return rows;
}

/** Container choices as stacked cards: a row per vehicle, expanding to its sizes. */
export function ContainerAccordion({ groups, value, openGroup, onOpenGroup, onSelect, other }: Props) {
  return (
    <div className="space-y-1.5">
      {toRows(groups).map((row, i) => {
        if (row.kind === "single") {
          return (
            <div
              key={row.groups.map(g => g.vehicle).join("-")}
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${row.groups.length}, minmax(0, 1fr))` }}
            >
              {row.groups.map(g => {
                const selected = value === g.options[0];
                return (
                  <button
                    key={g.vehicle}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center justify-between gap-1 rounded-2xl border bg-muted/40 px-3 py-2 text-left transition-colors",
                      selected ? "border-primary/50" : "border-border",
                    )}
                    onClick={() => onSelect(g.options[0], g.vehicle)}
                  >
                    <span className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
                      {g.vehicle}
                    </span>
                    <Check className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground/40")} />
                  </button>
                );
              })}
            </div>
          );
        }

        const g = row.group;
        const selected = value && g.options.includes(value) ? value : null;
        const open = openGroup === g.vehicle;
        return (
          <div
            key={g.vehicle}
            className={cn(
              "overflow-hidden rounded-2xl border bg-muted/40 transition-colors",
              selected ? "border-primary/50" : "border-border",
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              onClick={() => onOpenGroup(open ? null : g.vehicle)}
            >
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">{g.vehicle}</span>
                {selected ? (
                  <span className="text-[11px] font-medium text-primary">{containerChipLabel(selected)}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{g.options.length} types</span>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
                {g.options.map(o => (
                  <Button
                    key={o}
                    type="button"
                    size="sm"
                    variant={value === o ? "default" : "outline"}
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => onSelect(o, g.vehicle)}
                  >
                    {containerChipLabel(o)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {other && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border bg-muted/40 transition-colors",
            other.open ? "border-primary/50" : "border-dashed border-border",
          )}
        >
          <button
            type="button"
            aria-expanded={other.open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
            onClick={other.onOpen}
          >
            <span className="text-xs font-semibold text-foreground">{other.label ?? "Other vehicle type"}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", other.open && "rotate-180")} />
          </button>
          {other.open && <div className="border-t border-border px-3 py-2">{other.children}</div>}
        </div>
      )}
    </div>
  );
}
