import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ArrowLeft, Gauge, CalendarIcon } from "lucide-react";
import { format, subMonths, startOfMonth, endOfWeek } from "date-fns";
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const applyPreset = (preset: string) => {
    const now = new Date();
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
    }
  };

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
                  onSelect={(d) => d && setStartDate(d)}
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
                  onSelect={(d) => d && setEndDate(d)}
                  disabled={(d) => d < startDate || d > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-1.5 ml-2">
              {[
                { label: "3M", value: "3m" },
                { label: "6M", value: "6m" },
                { label: "12M", value: "12m" },
                { label: "24M", value: "24m" },
              ].map((p) => (
                <Button key={p.value} variant="outline" size="sm" className="text-xs h-8 px-3" onClick={() => applyPreset(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Total Waste Handled */}
          <TotalWasteHandled externalStartDate={startDate} externalEndDate={endDate} />

          {/* Waste Not On Midweigh */}
          <WasteNotOnMidweigh externalStartDate={startDate} externalEndDate={endDate} />

          {/* Grade C Wood KPIs */}
          <WasteKPIGradeCWood externalStartDate={startDate} externalEndDate={endDate} />
        </div>
      </main>
    </div>
  );
};

export default WasteKPIsPage;
