import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { ReportingPeriodQuickSelect } from "./ReportingPeriodQuickSelect";

type DateMode = "period" | "month" | "biffa";

interface ReportDateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  /** Forwarded to the Biffa Reporting Period quick-select. */
  customerId?: string;
  customerName?: string;
  allCustomers?: boolean;
  label?: string;
  numberOfMonths?: number;
  className?: string;
}

/**
 * Unified date selector offering three modes:
 *  - Period - specific dates (free date range)
 *  - Whole Month (single month navigator)
 *  - Biffa Reporting Period (customer custom reporting periods)
 */
export function ReportDateRangePicker({
  value,
  onChange,
  customerId,
  customerName,
  allCustomers,
  label = "Date Range",
  numberOfMonths = 2,
  className,
}: ReportDateRangePickerProps) {
  const [mode, setMode] = useState<DateMode>("period");
  const [month, setMonth] = useState<Date>(startOfMonth(value?.from ?? new Date()));

  // Keep the month navigator aligned with externally-set values.
  useEffect(() => {
    if (mode === "month" && value?.from) {
      setMonth(startOfMonth(value.from));
    }
  }, [value?.from, mode]);

  const applyMonth = (m: Date) => {
    setMonth(m);
    onChange({ from: startOfMonth(m), to: endOfMonth(m) });
  };

  const handleModeChange = (next: DateMode) => {
    setMode(next);
    if (next === "month") {
      applyMonth(month);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}
      <div className="flex flex-col gap-2">
        <Select value={mode} onValueChange={(v) => handleModeChange(v as DateMode)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="period">Period - specific dates</SelectItem>
            <SelectItem value="month">Whole Month</SelectItem>
            <SelectItem value="biffa">Biffa Reporting Period</SelectItem>
          </SelectContent>
        </Select>

        {mode === "period" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value?.from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value?.from ? (
                  value.to ? (
                    <>
                      {format(value.from, "d MMM yyyy")} – {format(value.to, "d MMM yyyy")}
                    </>
                  ) : (
                    format(value.from, "d MMM yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[200] pointer-events-auto" align="start">
              <Calendar
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onChange}
                numberOfMonths={numberOfMonths}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}

        {mode === "month" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => applyMonth(subMonths(month, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="flex-1 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(month, "MMMM yyyy")}
            </Button>
            <Button variant="outline" size="icon" onClick={() => applyMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {mode === "biffa" && (
          <ReportingPeriodQuickSelect
            customerId={customerId}
            customerName={customerName}
            allCustomers={allCustomers}
            label=""
            onSelect={(from, to) => onChange({ from, to })}
          />
        )}
      </div>
    </div>
  );
}
