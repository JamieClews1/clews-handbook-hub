import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { PoChecksDashboard } from "@/components/po-checks/PoChecksDashboard";

const PoChecksPage = () => {
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
      <main className="w-full px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/portal")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-8 bg-primary rounded-full" />
            <h1 className="text-3xl font-bold text-foreground">PO Checks</h1>
          </div>
          <p className="text-muted-foreground ml-5">
            See which Purchase Orders are required by customer and site, and request them by email
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Outstanding PO Requests
            </CardTitle>
            <CardDescription>
              Jobs missing a PO number, grouped by site. Send an automated PO request to the customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PoChecksDashboard />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PoChecksPage;
