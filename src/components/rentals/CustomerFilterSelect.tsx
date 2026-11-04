import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type CustomerOption = { name: string; count: number };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: CustomerOption[];
};

/**
 * Searchable "filter by customer" control for the Rentals lists.
 * `value` is "all" for no filter, otherwise a customer name.
 */
export default function CustomerFilterSelect({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [options],
  );

  const selected = sorted.find((o) => o.name === value) ?? null;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter by customer"
          className={cn("h-9 w-[240px] justify-between gap-2 font-normal", value !== "all" && "border-primary/40")}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", value === "all" && "text-muted-foreground")}>
              {value === "all" ? "All Customers" : value}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search customers…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No customer matches that search.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => { onChange("all"); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                All Customers
                <span className="ml-auto pl-3 text-xs text-muted-foreground">
                  {options.reduce((total, o) => total + o.count, 0)} bins
                </span>
              </CommandItem>
              {sorted.map((o) => (
                <CommandItem
                  key={o.name}
                  value={o.name}
                  onSelect={() => { onChange(o.name); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.name ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.name}</span>
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">
                    {o.count} {o.count === 1 ? "bin" : "bins"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
