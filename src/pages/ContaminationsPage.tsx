import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { PageHeading } from "@/components/PageHeading";
import ContaminationsDashboard from "@/components/contaminations/ContaminationsDashboard";
import ContaminationsQueryList from "@/components/contaminations/ContaminationsQueryList";
import ContaminationDetail from "@/components/contaminations/ContaminationDetail";
import ContaminationPricingMatrix from "@/components/contaminations/ContaminationPricingMatrix";
import ContaminationLeaderboard from "@/components/contaminations/ContaminationLeaderboard";

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
      <header className="hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/performance-hub">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <PageHeading title="Contaminations" />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="queries">All Queries</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings">Pricing & Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="dashboard">
            <ContaminationsDashboard onSelectQuery={setSelectedQueryId} onViewAll={() => setActiveTab("queries")} />
          </TabsContent>

          <TabsContent value="queries">
            <ContaminationsQueryList onSelectQuery={setSelectedQueryId} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <ContaminationLeaderboard />
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
