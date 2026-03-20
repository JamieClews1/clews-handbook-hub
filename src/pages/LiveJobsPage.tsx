import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Radio, Settings, MapPin, TrendingUp } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import LiveJobsDashboard from "@/components/live-jobs/LiveJobsDashboard";
import LiveJobsSettings from "@/components/live-jobs/LiveJobsSettings";
import ZonesSettings from "@/components/live-jobs/ZonesSettings";
import ZoneReport from "@/components/live-jobs/ZoneReport";
import ZoneTrends from "@/components/live-jobs/ZoneTrends";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { usePostcodeZones } from "@/hooks/usePostcodeZones";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";

type TrendsJob = {
  job_date: string | null;
  weight_t: number | null;
  raw: any;
  movement_type: string | null;
};

const LiveJobsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { settings, loading: settingsLoading, updateSetting, refetch } = useLiveJobsSettings();
  const { zones, loading: zonesLoading, updateZone, addZone, deleteZone } = usePostcodeZones();
  const [trendsJobs, setTrendsJobs] = useState<TrendsJob[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Lazy-load trends data when tab is selected
  useEffect(() => {
    if (activeTab !== "trends" || trendsLoaded) return;
    const fetchTrendsJobs = async () => {
      setTrendsLoading(true);
      const since = format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd");
      let allJobs: TrendsJob[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date,weight_t,raw,movement_type")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) { console.error(error); break; }
        allJobs = allJobs.concat((data ?? []) as TrendsJob[]);
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      setTrendsJobs(allJobs);
      setTrendsLoaded(true);
      setTrendsLoading(false);
    };
    fetchTrendsJobs();
  }, [activeTab, trendsLoaded]);

  if (loading || settingsLoading || zonesLoading) {
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
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-green-500 flex items-center justify-center shadow-lg">
              <Radio className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Live Jobs</h1>
              <p className="text-muted-foreground">
                Estimated live containers on-site from Skiptrak data
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="dashboard">
                <Radio className="h-4 w-4 mr-1.5" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="zones">
                <MapPin className="h-4 w-4 mr-1.5" /> Zone Report
              </TabsTrigger>
              <TabsTrigger value="trends" className="border border-border bg-background text-foreground shadow-sm rounded-full px-5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <TrendingUp className="h-4 w-4 mr-1.5" /> Zone Trends
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-1.5" /> Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard" className="mt-6">
              <LiveJobsDashboard settings={settings} />
            </TabsContent>
            <TabsContent value="zones" className="mt-6">
              <ZoneReport zones={zones} settings={settings} onAssignZone={async (zoneId, postcode) => {
                const zone = zones.find(z => z.id === zoneId);
                if (!zone) return;
                await updateZone(zoneId, { postcodes: [...zone.postcodes, postcode] });
              }} />
            </TabsContent>
            <TabsContent value="trends" className="mt-6">
              {trendsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                </div>
              ) : (
                <ZoneTrends jobs={trendsJobs} zones={zones} />
              )}
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <div className="space-y-6">
                <LiveJobsSettings settings={settings} onSave={async (key, value) => { await updateSetting(key, value); await refetch(); }} />
                <ZonesSettings
                  zones={zones}
                  onUpdate={updateZone}
                  onAdd={addZone}
                  onDelete={deleteZone}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default LiveJobsPage;
