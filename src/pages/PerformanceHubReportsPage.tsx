import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Sparkles } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import DataHubAIChat from "@/components/data-hub/DataHubAIChat";
import DataHubAnalytics from "@/components/data-hub/DataHubAnalytics";
import { useEffect } from "react";

const PerformanceHubReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
        <div className="max-w-6xl mx-auto space-y-8">
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

          <Tabs defaultValue="tracking" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Data Tracking
              </TabsTrigger>
              <TabsTrigger value="ask-ai" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Ask AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="space-y-8">
              <DataHubAnalytics />
            </TabsContent>

            <TabsContent value="ask-ai" className="space-y-8">
              <DataHubAIChat />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default PerformanceHubReportsPage;
