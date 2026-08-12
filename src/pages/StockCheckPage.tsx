import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ClipboardList, BarChart3, Settings, Boxes, PackageSearch, History } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { StockCheckDashboard } from "@/components/stock-check/StockCheckDashboard";
import { StockCheckTotalStock } from "@/components/stock-check/StockCheckTotalStock";
import { StockCheckInventory } from "@/components/stock-check/StockCheckInventory";
import { StockCheckTally } from "@/components/stock-check/StockCheckTally";
import { StockCheckSettings } from "@/components/stock-check/StockCheckSettings";
import { StockCheckHistory } from "@/components/stock-check/StockCheckHistory";
import { supabase } from "@/integrations/supabase/client";

const StockCheckPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [isManagement, setIsManagement] = useState(false);
  const [activeTab, setActiveTab] = useState("live");
  const [liveTab, setLiveTab] = useState("current");
  const [editCheckId, setEditCheckId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkManagement = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", user.id)
        .single();
      setIsManagement(profile?.user_types?.includes("management") || isAdmin);
    };
    checkManagement();
  }, [user, isAdmin]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  const canManageSettings = isAdmin || isManagement;

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
        <div className="max-w-screen-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Stock Check</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track current stock, totals, asset inventory and stock takes.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="live" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Live
              </TabsTrigger>
              <TabsTrigger value="total" className="gap-2">
                <Boxes className="h-4 w-4" />
                Total Stock
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2">
                <PackageSearch className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              {canManageSettings && (
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="h-4 w-4" />
                  Notifications
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="live">
              <Tabs
                value={liveTab}
                onValueChange={(v) => {
                  if (v !== "tally") setEditCheckId(null);
                  setLiveTab(v);
                }}
              >
                <TabsList className="mb-6">
                  <TabsTrigger value="current" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Current Stock
                  </TabsTrigger>
                  <TabsTrigger value="tally" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {editCheckId ? "Edit Stock Take" : "New Stock Take"}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-2">
                    <History className="h-4 w-4" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="current">
                  <StockCheckDashboard
                    onEditLast={(id) => {
                      setEditCheckId(id);
                      setLiveTab("tally");
                    }}
                    headerAction={
                      canManageSettings ? (
                        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <Settings className="h-4 w-4" />
                              Settings
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Stock Check Settings</DialogTitle>
                            </DialogHeader>
                            <StockCheckSettings />
                          </DialogContent>
                        </Dialog>
                      ) : undefined
                    }
                  />
                </TabsContent>
                <TabsContent value="tally">
                  <StockCheckTally
                    key={editCheckId ?? "new"}
                    userId={user.id}
                    editCheckId={editCheckId}
                    onComplete={() => {
                      setEditCheckId(null);
                      setLiveTab("current");
                    }}
                  />
                </TabsContent>
                <TabsContent value="history">
                  <StockCheckHistory />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="total">
              <StockCheckTotalStock />
            </TabsContent>
            <TabsContent value="inventory">
              <StockCheckInventory />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default StockCheckPage;
