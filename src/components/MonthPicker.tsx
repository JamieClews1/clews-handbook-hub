import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  selected: Date;
  onSelect: (date: Date) => void;
  /** "start" snaps to 1st of month, "end" snaps to last day */
  mode: "start" | "end";
  minDate?: Date;
  maxDate?: Date;
}

export const MonthPicker = ({ selected, onSelect, mode, minDate, maxDate }: MonthPickerProps) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.getFullYear());

  const currentYear = new Date().getFullYear();
  const maxYear = maxDate ? maxDate.getFullYear() : currentYear;
  const minYear = minDate ? minDate.getFullYear() : currentYear - 5;

  const handleMonthClick = (monthIndex: number) => {
    const d = new Date(viewYear, monthIndex, 1);
    const result = mode === "start" ? startOfMonth(d) : endOfMonth(d);
    onSelect(result);
    setOpen(false);
  };

  const isDisabled = (monthIndex: number) => {
    const monthStart = new Date(viewYear, monthIndex, 1);
    const monthEnd = endOfMonth(monthStart);
    if (minDate && monthEnd < startOfMonth(minDate)) return true;
    if (maxDate && monthStart > endOfMonth(maxDate)) return true;
    return false;
  };

  const isSelected = selected.getFullYear() === viewYear && selected.getMonth();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(selected, "MMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={viewYear <= minYear}
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={viewYear >= maxYear}
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Month grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((m, i) => {
            const sel = selected.getFullYear() === viewYear && selected.getMonth() === i;
            const disabled = isDisabled(i);
            return (
              <Button
                key={m}
                variant={sel ? "default" : "outline"}
                size="sm"
                className={cn("text-xs h-8", disabled && "opacity-40 pointer-events-none")}
                disabled={disabled}
                onClick={() => handleMonthClick(i)}
              >
                {m}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
