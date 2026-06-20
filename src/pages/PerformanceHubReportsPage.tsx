import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Sparkles, Settings2, Info } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";
import DataHubAIChat from "@/components/data-hub/DataHubAIChat";
import DataHubAnalytics from "@/components/data-hub/DataHubAnalytics";
import ZeroToLandfillChart from "@/components/data-hub/ZeroToLandfillChart";
import MidweighProductMappings from "@/components/data-hub/MidweighProductMappings";
import { MonthPicker } from "@/components/MonthPicker";
import { useLatestDataDate } from "@/hooks/useLatestDataDate";
import { useEffect } from "react";

const PerformanceHubReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const latestDataDate = useLatestDataDate();

  const now = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(subMonths(now, 11)));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(now));

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
        setEndDate(endOfMonth(now));
        break;
      case "6m":
        setStartDate(startOfMonth(subMonths(now, 5)));
        setEndDate(endOfMonth(now));
        break;
      case "12m":
        setStartDate(startOfMonth(subMonths(now, 11)));
        setEndDate(endOfMonth(now));
        break;
      case "24m":
        setStartDate(startOfMonth(subMonths(now, 23)));
        setEndDate(endOfMonth(now));
        break;
      case "ytd":
        setStartDate(startOfYear(now));
        setEndDate(endOfMonth(now));
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <div className="max-w-screen-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <BarChart3 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance Hub · Business Reports</h1>
              <p className="text-muted-foreground">
                Analytics, data tracking, and AI-powered insights
              </p>
            </div>
          </div>

          {/* Shared Period Selection */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <span className="text-sm font-medium text-foreground mr-1">Period:</span>
            <MonthPicker
              selected={startDate}
              onSelect={setStartDate}
              mode="start"
              maxDate={endDate}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <MonthPicker
              selected={endDate}
              onSelect={setEndDate}
              mode="end"
              minDate={startDate}
              maxDate={new Date()}
            />
            <div className="flex gap-1.5 ml-2">
              {[
                { label: "YTD", value: "ytd" },
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

            {/* Data up to note */}
            {latestDataDate && (
              <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                <span>Data up to <span className="font-medium text-foreground">{latestDataDate}</span></span>
              </div>
            )}
          </div>

          {/* Zero To Landfill Chart - Double Width */}
          <ZeroToLandfillChart externalStartDate={startDate} externalEndDate={endDate} />

          <Tabs defaultValue="tracking" className="space-y-6">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Data Tracking
              </TabsTrigger>
              <TabsTrigger value="ask-ai" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Ask AI
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="space-y-8">
              <DataHubAnalytics />
            </TabsContent>

            <TabsContent value="ask-ai" className="space-y-8">
              <DataHubAIChat />
            </TabsContent>

            <TabsContent value="settings" className="space-y-8">
              <MidweighProductMappings />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default PerformanceHubReportsPage;
