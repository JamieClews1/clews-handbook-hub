import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, DollarSign } from "lucide-react";
import { SiteReportGenerator } from "@/components/customer-reporting/SiteReportGenerator";
import { SiteRebateReportGenerator } from "@/components/customer-reporting/SiteRebateReportGenerator";

const CustomerReportingPage = () => {
  const [language, setLanguage] = useState("en");
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [isManagement, setIsManagement] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (!isAdmin && !isManagement)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Access denied. Management or Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header language={language} onLanguageChange={setLanguage} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/portal")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-8 bg-yellow-500 rounded-full" />
            <h1 className="text-3xl font-bold text-foreground">Customer Reporting</h1>
          </div>
          <p className="text-muted-foreground ml-5">
            Generate site reports and rebate reports for customers using Data Hub data
          </p>
        </div>

        <Tabs defaultValue="site-reports" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="site-reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Site Reports
            </TabsTrigger>
            <TabsTrigger value="rebate-reports" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Rebate Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="site-reports">
            <Card>
              <CardHeader>
                <CardTitle>Site Recycling Reports</CardTitle>
                <CardDescription>
                  Generate recycling and waste reports for customer sites using Data Hub data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SiteReportGenerator />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rebate-reports">
            <Card>
              <CardHeader>
                <CardTitle>Site Rebate Reports</CardTitle>
                <CardDescription>
                  Calculate rebate values for customer sites based on configured pricing and tonnage data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SiteRebateReportGenerator />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CustomerReportingPage;
