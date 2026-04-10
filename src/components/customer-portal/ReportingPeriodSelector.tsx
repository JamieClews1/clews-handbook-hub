import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function ReportingPeriodSelector({ customerId, onDateRangeChange, dateRange }: ReportingPeriodSelectorProps) {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [hasCustomPeriods, setHasCustomPeriods] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"period" | "month" | "custom">("month");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      setLoading(true);

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

        const loadedPeriods = periodsData ?? [];
        setPeriods(loadedPeriods);
        setMode("period");

        // Auto-select the current period based on today's date
        if (loadedPeriods.length > 0) {
          const today = new Date();
          const todayStr = today.toISOString().slice(0, 10);
          // Find the first period whose end date is >= today
          let autoSelect = loadedPeriods.find((p) => p.period_end_date >= todayStr);
          // Fallback to last period if all have passed
          if (!autoSelect) autoSelect = loadedPeriods[loadedPeriods.length - 1];

          setSelectedPeriodId(autoSelect.id);

          const idx = loadedPeriods.findIndex((p) => p.id === autoSelect!.id);
          let startDate: Date;
          if (idx > 0) {
            const prevEnd = new Date(loadedPeriods[idx - 1].period_end_date + "T00:00:00");
            startDate = new Date(prevEnd);
            startDate.setDate(startDate.getDate() + 1);
          } else {
            const endDate = new Date(autoSelect.period_end_date + "T00:00:00");
            startDate = startOfMonth(endDate);
          }
          const endDate = new Date(autoSelect.period_end_date + "T00:00:00");
          onDateRangeChange({ from: startDate, to: endDate });
        }
      }

      setLoading(false);
    };
    load();
  }, [customerId]);

  const handlePeriodSelect = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const period = periods.find((p) => p.id === periodId);
    if (!period) return;

    const idx = periods.findIndex((p) => p.id === periodId);
    let startDate: Date;
    if (idx > 0) {
      const prevEnd = new Date(periods[idx - 1].period_end_date + "T00:00:00");
      startDate = new Date(prevEnd);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      const endDate = new Date(period.period_end_date + "T00:00:00");
      startDate = startOfMonth(endDate);
    }

    const endDate = new Date(period.period_end_date + "T00:00:00");
    onDateRangeChange({ from: startDate, to: endDate });
  };

  const handleMonthClick = (monthIndex: number) => {
    const from = new Date(viewYear, monthIndex, 1);
    const to = endOfMonth(from);
    onDateRangeChange({ from, to });
    setMonthPickerOpen(false);
  };

  const currentYear = new Date().getFullYear();

  // Determine which month is currently selected
  const selectedMonth = dateRange?.from ? dateRange.from.getMonth() : -1;
  const selectedYear = dateRange?.from ? dateRange.from.getFullYear() : -1;

  const monthPickerLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
    : "Select a month";

  if (loading) return null;

  // No custom periods - show month picker + custom range
  if (!hasCustomPeriods) {
    return (
      <div className="space-y-2">
        <Label>Date Range</Label>
        <div className="flex gap-2">
          {/* Month picker */}
          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {monthPickerLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-3" align="start">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={viewYear <= currentYear - 3}
                  onClick={() => setViewYear((y) => y - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{viewYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={viewYear >= currentYear}
                  onClick={() => setViewYear((y) => y + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((m, i) => {
                  const sel = selectedYear === viewYear && selectedMonth === i;
                  const futureMonth = viewYear === currentYear && i > new Date().getMonth();
                  return (
                    <Button
                      key={m}
                      variant={sel ? "default" : "outline"}
                      size="sm"
                      className={cn("text-xs h-8", futureMonth && "opacity-40 pointer-events-none")}
                      disabled={futureMonth}
                      onClick={() => handleMonthClick(i)}
                    >
                      {m}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    const now = new Date();
                    onDateRangeChange({ from: subDays(now, 30), to: now });
                    setMonthPickerOpen(false);
                  }}
                >
                  Last 30 Days
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Custom range calendar */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Custom date range">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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
          <TabsTrigger value="month">Month</TabsTrigger>
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

      {mode === "month" && (
        <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from
                ? format(dateRange.from, "MMMM yyyy")
                : "Select a month"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-3" align="start">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={viewYear <= currentYear - 3}
                onClick={() => setViewYear((y) => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{viewYear}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={viewYear >= currentYear}
                onClick={() => setViewYear((y) => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((m, i) => {
                const sel = selectedYear === viewYear && selectedMonth === i;
                const futureMonth = viewYear === currentYear && i > new Date().getMonth();
                return (
                  <Button
                    key={m}
                    variant={sel ? "default" : "outline"}
                    size="sm"
                    className={cn("text-xs h-8", futureMonth && "opacity-40 pointer-events-none")}
                    disabled={futureMonth}
                    onClick={() => handleMonthClick(i)}
                  >
                    {m}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

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
