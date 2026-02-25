import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ClipboardList, BarChart3, Settings } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { StockCheckDashboard } from "@/components/stock-check/StockCheckDashboard";
import { StockCheckTally } from "@/components/stock-check/StockCheckTally";
import { StockCheckSettings } from "@/components/stock-check/StockCheckSettings";
import { StockCheckHistory } from "@/components/stock-check/StockCheckHistory";
import { supabase } from "@/integrations/supabase/client";

const StockCheckPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [isManagement, setIsManagement] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-6">Stock Check</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="dashboard" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="tally" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                New Tally
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                History
              </TabsTrigger>
              {canManageSettings && (
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="dashboard">
              <StockCheckDashboard />
            </TabsContent>
            <TabsContent value="tally">
              <StockCheckTally
                userId={user.id}
                onComplete={() => setActiveTab("dashboard")}
              />
            </TabsContent>
            <TabsContent value="history">
              <StockCheckHistory />
            </TabsContent>
            {canManageSettings && (
              <TabsContent value="settings">
                <StockCheckSettings />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default StockCheckPage;
