import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, DollarSign, Mail, Building2, LogOut } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { CustomerPortalSiteReport } from "@/components/customer-portal/CustomerPortalSiteReport";
import { CustomerPortalRebateReport } from "@/components/customer-portal/CustomerPortalRebateReport";
import { CustomerPortalContactForm } from "@/components/customer-portal/CustomerPortalContactForm";
import { CustomerPortalLogin } from "@/components/customer-portal/CustomerPortalLogin";

type PortalMembership = {
  id: string;
  customer_id: string;
  customers: {
    id: string;
    customer_name: string;
    customer_code: string;
  };
};

const CustomerPortalPage = () => {
  const { user, loading, signOut } = useAuth();
  const [membership, setMembership] = useState<PortalMembership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  useEffect(() => {
    const loadMembership = async () => {
      if (!user) {
        setMembership(null);
        setLoadingMembership(false);
        return;
      }
      
      setLoadingMembership(true);
      
      const { data, error } = await supabase
        .from("customer_portal_memberships")
        .select(`
          id,
          customer_id,
          customers (
            id,
            customer_name,
            customer_code
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setMembership(data as unknown as PortalMembership);
      }
      setLoadingMembership(false);
    };

    loadMembership();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    setMembership(null);
  };

  // Show login screen if not authenticated
  if (!loading && !user) {
    return <CustomerPortalLogin onLoginSuccess={() => {}} />;
  }

  if (loading || loadingMembership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                Your account is not linked to any customer portal. Please contact your account manager for access.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Customer Portal</h1>
              <p className="text-muted-foreground text-sm">
                Welcome, {membership.customers.customer_name}
              </p>
            </div>
          </div>

          <Tabs defaultValue="site-reports" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="site-reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Site Reports</span>
                <span className="sm:hidden">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="rebate-reports" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Rebate Reports</span>
                <span className="sm:hidden">Rebates</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Contact Us</span>
                <span className="sm:hidden">Contact</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="site-reports">
              <Card>
                <CardHeader>
                  <CardTitle>Site Recycling Reports</CardTitle>
                  <CardDescription>
                    Generate recycling and waste reports for your sites
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomerPortalSiteReport 
                    customerId={membership.customer_id}
                    customerName={membership.customers.customer_name}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rebate-reports">
              <Card>
                <CardHeader>
                  <CardTitle>Rebate Reports</CardTitle>
                  <CardDescription>
                    Download rebate reports based on your site pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomerPortalRebateReport 
                    customerId={membership.customer_id}
                    customerName={membership.customers.customer_name}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Customer Service</CardTitle>
                  <CardDescription>
                    Send a request or enquiry to our customer service team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomerPortalContactForm 
                    customerId={membership.customer_id}
                    customerName={membership.customers.customer_name}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default CustomerPortalPage;
