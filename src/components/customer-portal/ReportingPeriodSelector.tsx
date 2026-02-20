import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type ReportingPeriod = {
  id: string;
  period_label: string;
  month_name: string;
  period_end_date: string;
  display_order: number;
};

interface ReportingPeriodSelectorProps {
  customerId: string;
  onDateRangeChange: (range: DateRange | undefined) => void;
  dateRange: DateRange | undefined;
}

export function ReportingPeriodSelector({ customerId, onDateRangeChange, dateRange }: ReportingPeriodSelectorProps) {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [hasCustomPeriods, setHasCustomPeriods] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"period" | "month" | "custom">("month");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Check if customer has custom periods enabled
      const { data: customer } = await supabase
        .from("customers")
        .select("custom_reporting_periods_enabled")
        .eq("id", customerId)
        .single();

      const enabled = customer?.custom_reporting_periods_enabled ?? false;
      setHasCustomPeriods(enabled);

      if (enabled) {
        const { data: periodsData } = await supabase
          .from("customer_reporting_periods")
          .select("*")
          .eq("customer_id", customerId)
          .order("display_order");

        setPeriods(periodsData ?? []);
        setMode("period");
      }

      setLoading(false);
    };
    load();
  }, [customerId]);

  const handlePeriodSelect = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const period = periods.find((p) => p.id === periodId);
    if (!period) return;

    // Find the previous period to determine start date
    const idx = periods.findIndex((p) => p.id === periodId);
    let startDate: Date;
    if (idx > 0) {
      // Start is the day after the previous period's end date
      const prevEnd = new Date(periods[idx - 1].period_end_date + "T00:00:00");
      startDate = new Date(prevEnd);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      // First period: assume start is beginning of the month referenced
      const endDate = new Date(period.period_end_date + "T00:00:00");
      startDate = startOfMonth(endDate);
    }

    const endDate = new Date(period.period_end_date + "T00:00:00");
    onDateRangeChange({ from: startDate, to: endDate });
  };

  if (loading) return null;

  // No custom periods - just show standard date range picker
  if (!hasCustomPeriods) {
    return (
      <div className="space-y-2">
        <Label>Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "dd MMM yyyy")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Has custom periods - show mode tabs
  return (
    <div className="space-y-3">
      <Label>Date Selection</Label>
      <Tabs value={mode} onValueChange={(v) => setMode(v as "period" | "month" | "custom")} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="period">Reporting Period</TabsTrigger>
          <TabsTrigger value="month">Calendar Month</TabsTrigger>
          <TabsTrigger value="custom">Custom Range</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "period" && (
        <Select value={selectedPeriodId} onValueChange={handlePeriodSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select reporting period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.period_label} — {p.month_name} (ends {format(new Date(p.period_end_date + "T00:00:00"), "dd/MM/yyyy")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "month" && (() => {
        const months = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const now = new Date();
        const currentYear = now.getFullYear();
        const years = [currentYear - 1, currentYear, currentYear + 1];
        
        const handleMonthSelect = (monthYear: string) => {
          const [yearStr, monthStr] = monthYear.split("-");
          const year = parseInt(yearStr);
          const month = parseInt(monthStr) - 1;
          const from = new Date(year, month, 1);
          const to = endOfMonth(from);
          onDateRangeChange({ from, to });
        };
        
        const selectedValue = dateRange?.from
          ? `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}`
          : "";
        
        return (
          <Select value={selectedValue} onValueChange={handleMonthSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a month" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) =>
                months.map((monthName, idx) => {
                  const value = `${year}-${String(idx + 1).padStart(2, "0")}`;
                  return (
                    <SelectItem key={value} value={value}>
                      {monthName} {year}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        );
      })()}

      {mode === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "dd MMM yyyy")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}

      {dateRange?.from && dateRange?.to && (
        <p className="text-xs text-muted-foreground">
          Selected: {format(dateRange.from, "dd/MM/yyyy")} — {format(dateRange.to, "dd/MM/yyyy")}
        </p>
      )}
    </div>
  );
}
