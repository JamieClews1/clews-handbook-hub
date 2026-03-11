import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ArrowLeft, Gauge, CalendarIcon, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subMonths, subYears, startOfMonth, endOfWeek, startOfYear } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";
import WasteKPIGradeCWood from "@/components/data-hub/WasteKPIGradeCWood";
import TotalWasteHandled from "@/components/data-hub/TotalWasteHandled";
import WasteNotOnMidweigh from "@/components/data-hub/WasteNotOnMidweigh";
import WasteOnsiteOffsite from "@/components/data-hub/WasteOnsiteOffsite";

const WasteKPIsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const now = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(subMonths(now, 11)));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(now, { weekStartsOn: 1 }));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [compareYears, setCompareYears] = useState<number>(0); // 0 = off, 1 = vs last year, 2 = vs last 2 years

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const applyPreset = (preset: string) => {
    const now = new Date();
    setActivePreset(preset);
    if (preset !== "ytd") {
      setCompareYears(0);
    }
    switch (preset) {
      case "3m":
        setStartDate(startOfMonth(subMonths(now, 2)));
        setEndDate(now);
        break;
      case "6m":
        setStartDate(startOfMonth(subMonths(now, 5)));
        setEndDate(now);
        break;
      case "12m":
        setStartDate(startOfMonth(subMonths(now, 11)));
        setEndDate(now);
        break;
      case "24m":
        setStartDate(startOfMonth(subMonths(now, 23)));
        setEndDate(now);
        break;
      case "ytd":
        setStartDate(startOfYear(now));
        setEndDate(now);
        break;
    }
  };

  const handleManualDateChange = (setter: (d: Date) => void) => (d: Date | undefined) => {
    if (d) {
      setter(d);
      setActivePreset(null);
      setCompareYears(0);
    }
  };

  const isYTD = activePreset === "ytd";

  // Generate previous year date ranges for comparison
  const previousYearRanges = useMemo(() => {
    if (!isYTD || compareYears === 0) return [];
    const ranges: { year: number; start: Date; end: Date }[] = [];
    const currentYear = now.getFullYear();
    const currentDayOfYear = now;

    for (let i = 1; i <= compareYears; i++) {
      const prevYear = currentYear - i;
      const prevStart = startOfYear(new Date(prevYear, 0, 1));
      // End at the same day-of-year in previous year (or end of year if we're past it)
      const prevEnd = new Date(prevYear, currentDayOfYear.getMonth(), currentDayOfYear.getDate());
      ranges.push({ year: prevYear, start: prevStart, end: prevEnd });
    }
    return ranges;
  }, [isYTD, compareYears]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const currentYear = now.getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/performance-hub">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Performance Hub</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Gauge className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance Hub · Waste KPIs</h1>
              <p className="text-muted-foreground">
                Total waste handled and Grade C Wood recovery metrics
              </p>
            </div>
          </div>

          {/* Period Selection */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <span className="text-sm font-medium text-foreground mr-1">Period:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleManualDateChange(setStartDate)}
                  disabled={(d) => d > endDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={handleManualDateChange(setEndDate)}
                  disabled={(d) => d < startDate || d > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-1.5 ml-2">
              {[
                { label: "YTD", value: "ytd" },
                { label: "3M", value: "3m" },
                { label: "6M", value: "6m" },
                { label: "12M", value: "12m" },
                { label: "24M", value: "24m" },
              ].map((p) => (
                <Button
                  key={p.value}
                  variant={activePreset === p.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8 px-3"
                  onClick={() => applyPreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Compare previous years - only shown when YTD is active */}
            {isYTD && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
                <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mr-1">Compare:</span>
                <Button
                  variant={compareYears === 0 ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setCompareYears(0)}
                >
                  Off
                </Button>
                <Button
                  variant={compareYears === 1 ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setCompareYears(1)}
                >
                  vs {currentYear - 1}
                </Button>
                <Button
                  variant={compareYears === 2 ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setCompareYears(2)}
                >
                  vs {currentYear - 1} & {currentYear - 2}
                </Button>
              </div>
            )}
          </div>

          {/* Current Year Charts */}
          {isYTD && compareYears > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                {currentYear} — Year to Date
              </Badge>
            </div>
          )}

          <TotalWasteHandled externalStartDate={startDate} externalEndDate={endDate} comparisonRanges={previousYearRanges} />
          <WasteNotOnMidweigh externalStartDate={startDate} externalEndDate={endDate} comparisonRanges={previousYearRanges} />
          <WasteOnsiteOffsite externalStartDate={startDate} externalEndDate={endDate} comparisonRanges={previousYearRanges} />
          <WasteKPIGradeCWood externalStartDate={startDate} externalEndDate={endDate} />
        </div>
      </main>
    </div>
  );
};

export default WasteKPIsPage;
