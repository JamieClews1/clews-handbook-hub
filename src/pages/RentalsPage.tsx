import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PoundSterling, AlertTriangle, FileCheck, MapPin } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import RentalsDashboard from "@/components/rentals/RentalsDashboard";
import RentalAgreements from "@/components/rentals/RentalAgreements";
import OtherRentalsPostcodes from "@/components/rentals/OtherRentalsPostcodes";
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

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-screen-2xl mx-auto space-y-8">
          <PageHeading title="Rentals" description="Over-rental bins and rental agreements" />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="over-rental">
                <AlertTriangle className="h-4 w-4 mr-1.5" /> Over Rental
              </TabsTrigger>
              <TabsTrigger value="agreements">
                <FileCheck className="h-4 w-4 mr-1.5" /> Rental Agreements
              </TabsTrigger>
              <TabsTrigger value="other-rentals">
                <MapPin className="h-4 w-4 mr-1.5" /> Bin Rentals (Other 1)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="over-rental" className="mt-6">
              <RentalsDashboard />
            </TabsContent>
            <TabsContent value="agreements" className="mt-6">
              <RentalAgreements />
            </TabsContent>
            <TabsContent value="other-rentals" className="mt-6">
              <OtherRentalsPostcodes />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RentalsPage;
