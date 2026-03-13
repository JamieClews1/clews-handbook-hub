import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Radio, Settings, MapPin } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import LiveJobsDashboard from "@/components/live-jobs/LiveJobsDashboard";
import LiveJobsSettings from "@/components/live-jobs/LiveJobsSettings";
import ZonesSettings from "@/components/live-jobs/ZonesSettings";
import ZoneReport from "@/components/live-jobs/ZoneReport";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { usePostcodeZones } from "@/hooks/usePostcodeZones";
import { useEffect } from "react";

const LiveJobsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { settings, loading: settingsLoading, updateSetting, refetch } = useLiveJobsSettings();
  const { zones, loading: zonesLoading, updateZone, addZone, deleteZone } = usePostcodeZones();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

          <Tabs defaultValue="dashboard">
            <TabsList>
              <TabsTrigger value="dashboard">
                <Radio className="h-4 w-4 mr-1.5" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="zones">
                <MapPin className="h-4 w-4 mr-1.5" /> Zone Report
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
