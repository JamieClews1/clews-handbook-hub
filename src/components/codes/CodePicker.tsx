import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeMatches } from "@/lib/code-registers";
import { useEwcCodes, useSicCodes } from "@/hooks/useCodeRegisters";

interface Option {
  code: string;
  description: string;
  hazardous?: boolean;
  group: string;
  is_common?: boolean;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  options: Option[];
  loading?: boolean;
  emptyLabel: string;
}

const CodeCombobox = ({ value, onChange, placeholder, options, loading, emptyLabel }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const matches = options.filter((o) => codeMatches(query, o.code, o.description));
    if (!query.trim()) {
      const common = matches.filter((o) => o.is_common);
      if (common.length) return [...common, ...matches.filter((o) => !o.is_common)].slice(0, 120);
    }
    return matches.slice(0, 120);
  }, [options, query]);

  const selected = options.find((o) => o.code.replace(/\s/g, "") === (value || "").replace(/\s/g, ""));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${value}${selected ? ` — ${selected.description}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,90vw)] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or description…"
            className="h-8"
          />
        </div>
        <ScrollArea className="h-72">
          {loading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
          )}
          <div className="p-1">
            {filtered.map((o) => (
              <button
                key={o.code}
                type="button"
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent flex items-start gap-2"
                onClick={() => {
                  onChange(o.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check className={cn("h-4 w-4 mt-0.5 shrink-0", selected?.code === o.code ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0">
                  <span className="font-mono text-sm mr-2">{o.code}</span>
                  {o.hazardous && (
                    <Badge variant="destructive" className="text-[10px] align-middle">Hazardous</Badge>
                  )}
                  <span className="block text-xs text-muted-foreground truncate">{o.description}</span>
                  <span className="block text-[10px] text-muted-foreground/70 truncate">{o.group}</span>
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
        {value && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { onChange(""); setOpen(false); }}>
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const EwcCodePicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { data, isLoading } = useEwcCodes();
  const options: Option[] = (data ?? []).map((c) => ({
    code: c.hazardous ? `${c.code}*` : c.code,
    description: c.description,
    hazardous: c.hazardous,
    is_common: c.is_common,
    group: `Chapter ${c.chapter} — ${c.chapter_name}`,
  }));
  return (
    <CodeCombobox
      value={value}
      onChange={onChange}
      options={options}
      loading={isLoading}
      placeholder="Select EWC code"
      emptyLabel="No waste code found."
    />
  );
};

export const SicCodePicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { data, isLoading } = useSicCodes();
  const options: Option[] = (data ?? []).map((c) => ({
    code: c.code,
    description: c.description,
    is_common: c.is_common,
    group: `Section ${c.section} — ${c.section_name}`,
  }));
  return (
    <CodeCombobox
      value={value}
      onChange={onChange}
      options={options}
      loading={isLoading}
      placeholder="Select SIC code"
      emptyLabel="No industry code found."
    />
  );
};
