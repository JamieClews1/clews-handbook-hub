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

/** Container choices as stacked cards: a group row per vehicle, expanding to its sizes. */
export function ContainerAccordion({ groups, value, openGroup, onOpenGroup, onSelect, other }: Props) {
  return (
    <div className="space-y-2">
      {groups.map(g => {
        const selected = value && g.options.includes(value) ? value : null;
        const single = g.options.length === 1;
        const open = !single && openGroup === g.vehicle;
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
              aria-expanded={single ? undefined : open}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
              onClick={() => (single ? onSelect(g.options[0], g.vehicle) : onOpenGroup(open ? null : g.vehicle))}
            >
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">{g.vehicle}</span>
                {selected ? (
                  <span className="text-[11px] font-medium text-primary">{containerChipLabel(selected)}</span>
                ) : single ? null : (
                  <span className="text-[11px] text-muted-foreground">{g.options.length} types</span>
                )}
              </span>
              {single ? (
                <Check className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground/40")} />
              ) : (
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
              )}
            </button>
            {open && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
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
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
            onClick={other.onOpen}
          >
            <span className="text-xs font-semibold text-foreground">{other.label ?? "Other vehicle type"}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", other.open && "rotate-180")} />
          </button>
          {other.open && <div className="border-t border-border px-4 py-2.5">{other.children}</div>}
        </div>
      )}
    </div>
  );
}
