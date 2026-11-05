import { useMemo, useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SizeFilterOption } from "@/lib/stock-check-size-filter";

type Props = {
  options: SizeFilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
};

/**
 * "Filter by size" control for the Stock Check views. Nothing selected means
 * every size is shown, so the stock tables stay exactly as they were before.
 */
export const SizeFilter = ({ options, selected, onChange, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byGroup = new Map<string, SizeFilterOption[]>();
    for (const option of options) {
      if (q && !option.name.toLowerCase().includes(q)) continue;
      const group = option.group ?? "Sizes";
      const list = byGroup.get(group);
      if (list) list.push(option);
      else byGroup.set(group, [option]);
    }
    return [...byGroup.entries()];
  }, [options, search]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const label = selected.length === 0 ? "All sizes" : `${selected.length} size${selected.length > 1 ? "s" : ""}`;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
            aria-label="Filter by size"
          >
            <Filter className="h-3.5 w-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="border-b border-border p-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sizes…"
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {groups.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">No sizes match “{search}”.</p>
            )}
            {groups.map(([group, items]) => (
              <div key={group}>
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                {items.map((option) => {
                  const active = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggle(option.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span className="text-foreground">{option.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
            >
              All sizes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange(options.map((o) => o.id))}
              disabled={selected.length === options.length}
            >
              Select all
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => onChange([])}
          aria-label="Clear size filter"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
};
