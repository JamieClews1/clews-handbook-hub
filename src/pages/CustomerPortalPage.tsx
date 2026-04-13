import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, DollarSign, Mail, Building2, LogOut, Shield, Package, CalendarCheck } from "lucide-react";
import w1Logo from "@/assets/w1-logo.png";
import { CustomerPortalSiteReport } from "@/components/customer-portal/CustomerPortalSiteReport";
import { CustomerPortalRebateReport } from "@/components/customer-portal/CustomerPortalRebateReport";
import { CustomerPortalContactForm } from "@/components/customer-portal/CustomerPortalContactForm";
import { CustomerPortalLogin } from "@/components/customer-portal/CustomerPortalLogin";
import { CustomerPortalProfile } from "@/components/customer-portal/CustomerPortalProfile";
import { StaciReportsDashboard } from "@/components/staci/StaciReportsDashboard";
import { CustomerPortalBookings } from "@/components/customer-portal/CustomerPortalBookings";

type PortalMembership = {
  id: string;
  customer_id: string;
  contact_id: string | null;
  customers: {
    id: string;
    customer_name: string;
    customer_code: string;
  };
};

type Customer = {
  id: string;
  customer_name: string;
  customer_code: string;
};

const CustomerPortalPage = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [membership, setMembership] = useState<PortalMembership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [accessibleSites, setAccessibleSites] = useState<{ id: string; site_name: string }[]>([]);
  const [accessibleSiteIds, setAccessibleSiteIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setMembership(null);
        setLoadingMembership(false);
        return;
      }
      
      setLoadingMembership(true);
      
      // If admin, load all customers for selection
      if (isAdmin) {
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, customer_name, customer_code")
          .order("customer_name");
        
        if (customersData && customersData.length > 0) {
          setCustomers(customersData);
          setSelectedCustomerId(customersData[0].id);
        }
        setLoadingMembership(false);
        return;
      }
      
      // For non-admins, check membership
      const { data, error } = await supabase
        .from("customer_portal_memberships")
        .select(`
          id,
          customer_id,
          contact_id,
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
        
        // Compute accessible site IDs from explicit access + owner contact
        const siteIdSet = new Set<string>();

        // 1. Explicit site access records
        const { data: explicitAccess } = await supabase
          .from("customer_portal_site_access")
          .select("site_id")
          .eq("membership_id", data.id);
        (explicitAccess ?? []).forEach(a => siteIdSet.add(a.site_id));

        // 2. Sites where user is the owner contact
        if (data.contact_id) {
          const { data: ownerSites } = await supabase
            .from("customer_sites")
            .select("id")
            .eq("customer_id", data.customer_id)
            .eq("owner_contact_id", data.contact_id);
          (ownerSites ?? []).forEach(s => siteIdSet.add(s.id));
        }

        const siteIdArray = Array.from(siteIdSet);
        setAccessibleSiteIds(siteIdArray);

        if (siteIdArray.length > 0) {
          const { data: sitesData } = await supabase
            .from("customer_sites")
            .select("id, site_name")
            .in("id", siteIdArray);
          setAccessibleSites(sitesData ?? []);
        } else {
          setAccessibleSites([]);
        }
      }
      setLoadingMembership(false);
    };

    loadData();
  }, [user, isAdmin]);

  const handleLogout = async () => {
    await signOut();
    setMembership(null);
    setCustomers([]);
    setSelectedCustomerId(null);
    setAccessibleSites([]);
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

  // Get customer info based on admin or regular user
  const currentCustomer = isAdmin && selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)
    : membership?.customers;

  const currentCustomerId = isAdmin ? selectedCustomerId : membership?.customer_id;

  // Non-admin without membership
  if (!isAdmin && !membership) {
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
              <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
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

  // Admin without any customers in system
  if (isAdmin && customers.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
              <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>No Customers Found</CardTitle>
              <CardDescription>
                There are no customers set up yet. Please add customers in the Admin → Customer Setup section.
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
            <div className="flex items-center gap-4">
              <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Shield className="h-3 w-3" />
                  Admin View
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              {!isAdmin && user && (
                <CustomerPortalProfile
                  userEmail={user.email || ""}
                  customerName={currentCustomer?.customer_name || ""}
                  managedSites={accessibleSites}
                />
              )}
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-6">
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Customer Portal</h1>
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? "Viewing as admin" : `Welcome, ${currentCustomer?.customer_name}`}
                </p>
              </div>
            </div>
            
            {isAdmin && customers.length > 0 && (
              <Select value={selectedCustomerId || ""} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {(() => {
            const isStaciCustomer = currentCustomer?.customer_name?.toLowerCase().includes("staci");
            const fallbackTab = isStaciCustomer ? "staci-reports" : "site-reports";
            const storedTab = sessionStorage.getItem("portal-active-tab");
            const defaultTab = storedTab || fallbackTab;
            const tabCount = isStaciCustomer ? 3 : 5;
            return (
            <Tabs defaultValue={defaultTab} onValueChange={(v) => sessionStorage.setItem("portal-active-tab", v)} className="space-y-6">
            <TabsList className={`grid w-full max-w-2xl grid-cols-${tabCount}`}>
              {!isStaciCustomer && (
                <TabsTrigger value="site-reports" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Site Reports</span>
                  <span className="sm:hidden">Reports</span>
                </TabsTrigger>
              )}
              {!isStaciCustomer && (
                <TabsTrigger value="rebate-reports" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Rebate Reports</span>
                  <span className="sm:hidden">Rebates</span>
                </TabsTrigger>
              )}
              {isStaciCustomer && (
                <TabsTrigger value="staci-reports" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">STACI Reports</span>
                  <span className="sm:hidden">STACI</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="bookings" className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Bookings</span>
                <span className="sm:hidden">Book</span>
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
                  {currentCustomerId && currentCustomer && (
                    <CustomerPortalSiteReport 
                      customerId={currentCustomerId}
                      customerName={currentCustomer.customer_name}
                      accessibleSiteIds={!isAdmin ? accessibleSiteIds : undefined}
                    />
                  )}
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
                  {currentCustomerId && currentCustomer && (
                    <CustomerPortalRebateReport 
                      customerId={currentCustomerId}
                      customerName={currentCustomer.customer_name}
                      accessibleSiteIds={!isAdmin ? accessibleSiteIds : undefined}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staci-reports">
              {currentCustomerId && (
                <StaciReportsDashboard
                  customerId={currentCustomerId}
                  customerName={currentCustomer?.customer_name}
                  isPortalView={!isAdmin}
                />
              )}
            </TabsContent>

            <TabsContent value="bookings">
              <Card>
                <CardHeader>
                  <CardTitle>Collection Bookings</CardTitle>
                  <CardDescription>
                    View your bookings and request new collections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentCustomerId && currentCustomer && (
                    <CustomerPortalBookings
                      customerId={currentCustomerId}
                      customerName={currentCustomer.customer_name}
                      accessibleSiteIds={!isAdmin ? accessibleSiteIds : undefined}
                    />
                  )}
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
                  {currentCustomerId && currentCustomer && (
                    <CustomerPortalContactForm 
                      customerId={currentCustomerId}
                      customerName={currentCustomer.customer_name}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default CustomerPortalPage;
