import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PoundSterling, AlertTriangle, FileCheck } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import RentalsDashboard from "@/components/rentals/RentalsDashboard";
import RentalAgreements from "@/components/rentals/RentalAgreements";
import { useEffect, useState } from "react";

const RentalsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("over-rental");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
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
        <div className="max-w-screen-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-green-500 flex items-center justify-center shadow-lg">
              <PoundSterling className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rentals</h1>
              <p className="text-muted-foreground">
                Track bins over rental, chase customers, and manage confirmed rental agreements
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="over-rental">
                <AlertTriangle className="h-4 w-4 mr-1.5" /> Over Rental
              </TabsTrigger>
              <TabsTrigger value="agreements">
                <FileCheck className="h-4 w-4 mr-1.5" /> Rental Agreements
              </TabsTrigger>
            </TabsList>
            <TabsContent value="over-rental" className="mt-6">
              <RentalsDashboard />
            </TabsContent>
            <TabsContent value="agreements" className="mt-6">
              <RentalAgreements />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RentalsPage;
