import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AlphabetJumpSelectItem {
  value: string;
  label: string;
}

interface AlphabetJumpSelectProps {
  items: AlphabetJumpSelectItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  emptyMessage?: string;
}

function getFirstLetter(label: string) {
  const char = label.trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(char)) return char;
  return "#";
}

export function AlphabetJumpSelect({
  items,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  id,
  className,
  emptyMessage = "No items found.",
}: AlphabetJumpSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const headerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const filteredItems = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.label.toLowerCase().includes(query));
  }, [items, search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, AlphabetJumpSelectItem[]>();
    filteredItems.forEach((item) => {
      const letter = getFirstLetter(item.label);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [filteredItems]);

  const availableLetters = React.useMemo(() => grouped.map(([letter]) => letter), [grouped]);

  const selectedLabel = React.useMemo(
    () => items.find((item) => item.value === value)?.label ?? placeholder,
    [items, value, placeholder]
  );

  const handleSelect = (itemValue: string) => {
    onChange(itemValue);
    setOpen(false);
    setSearch("");
  };

  const jumpToLetter = (letter: string) => {
    const header = headerRefs.current[letter];
    if (header && listRef.current) {
      listRef.current.scrollTo({
        top: header.offsetTop - listRef.current.offsetTop,
        behavior: "smooth",
      });
    }
  };

  React.useEffect(() => {
    if (open) {
      setSearch("");
      // Small delay to allow the popover to render before scrolling to selection
      requestAnimationFrame(() => {
        const selectedLetter = items.find((item) => item.value === value)?.label
          ? getFirstLetter(items.find((item) => item.value === value)!.label)
          : availableLetters[0];
        if (selectedLetter) jumpToLetter(selectedLetter);
      });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal bg-background hover:bg-accent hover:text-accent-foreground",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex h-[360px]">
          <div className="flex flex-col flex-1 min-w-0">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
              ) : (
                grouped.map(([letter, groupItems]) => (
                  <div key={letter}>
                    <div
                      ref={(el) => (headerRefs.current[letter] = el)}
                      className="sticky top-0 z-10 px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/90 backdrop-blur rounded"
                    >
                      {letter}
                    </div>
                    <div className="mt-1 mb-3">
                      {groupItems.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleSelect(item.value)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent hover:text-accent-foreground",
                            value === item.value && "bg-accent text-accent-foreground font-medium"
                          )}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              value === item.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {availableLetters.length > 0 && (
            <div className="w-8 border-l border-border bg-muted/30 flex flex-col items-center py-2 overflow-y-auto scrollbar-thin">
              {availableLetters.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => jumpToLetter(letter)}
                  className="w-6 h-5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center justify-center transition-colors"
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
