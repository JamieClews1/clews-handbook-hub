import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import ContaminationsDashboard from "@/components/contaminations/ContaminationsDashboard";
import ContaminationsQueryList from "@/components/contaminations/ContaminationsQueryList";
import ContaminationDetail from "@/components/contaminations/ContaminationDetail";
import ContaminationPricingMatrix from "@/components/contaminations/ContaminationPricingMatrix";

const ContaminationsPage = () => {
  const { user, isAdmin } = useAuth();
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user) return null;

  if (selectedQueryId) {
    return (
      <ContaminationDetail
        queryId={selectedQueryId}
        onBack={() => setSelectedQueryId(null)}
        isAdmin={isAdmin}
      />
    );
  }

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
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h1 className="text-3xl font-bold text-foreground">Contaminations Portal</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="queries">All Queries</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings">Pricing & Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="dashboard">
            <ContaminationsDashboard onSelectQuery={setSelectedQueryId} onViewAll={() => setActiveTab("queries")} />
          </TabsContent>

          <TabsContent value="queries">
            <ContaminationsQueryList onSelectQuery={setSelectedQueryId} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings">
              <ContaminationPricingMatrix />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ContaminationsPage;
