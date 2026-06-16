import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, FileText, DollarSign, Mail, Building2, LogOut, Shield,
  CalendarCheck, Fuel, Layers,
} from "lucide-react";
import w1Logo from "@/assets/w1-logo.png";
import { CustomerPortalSiteReport } from "@/components/customer-portal/CustomerPortalSiteReport";
import { CustomerPortalRebateReport } from "@/components/customer-portal/CustomerPortalRebateReport";
import { CustomerPortalContactForm } from "@/components/customer-portal/CustomerPortalContactForm";
import { CustomerPortalLogin } from "@/components/customer-portal/CustomerPortalLogin";
import { CustomerPortalProfile } from "@/components/customer-portal/CustomerPortalProfile";
import { CustomerPortalServices } from "@/components/customer-portal/CustomerPortalServices";
import { CustomerPortalFuelSurcharges } from "@/components/customer-portal/CustomerPortalFuelSurcharges";

// Reconomy umbrella: list of customer name patterns (case-insensitive substring).
// Admin can extend this later; we match by customer_name to be resilient
// to spelling/legal-suffix variants and to pick up records that aren't
// in the DB yet (e.g. AMA Waste).
const RECONOMY_NAME_PATTERNS = [
  "reconomy (uk)",
  "reconomy solutions",
  "ama waste",
  "circle waste",
  "advanced waste solutions",
  "ecofficiency",
];

type Customer = {
  id: string;
  customer_name: string;
  customer_code: string;
  is_broker?: boolean | null;
};

type PortalSite = { id: string; site_name: string; broker_subclient: string | null };

type MembershipRow = {
  id: string;
  customer_id: string;
  contact_id: string | null;
};

const ALL_CUSTOMERS = "__all_reconomy__";
const ALL_SUBCLIENTS = "__all_subclients__";
const ALL_SITES = "__all_sites__";

// Virtual merged entity: combines "Reconomy (UK) Limited" + "Reconomy Solutions"
// into a single sub-brand button/scope.
const RECONOMY_MERGED_ID = "__reconomy_merged__";
const RECONOMY_MERGED_NAME = "Reconomy";
const isReconomyCoreName = (name: string | null | undefined) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes("reconomy (uk)") || lower.includes("reconomy solutions");
};

const matchesReconomy = (name: string | null | undefined) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return RECONOMY_NAME_PATTERNS.some((p) => lower.includes(p));
};

const ReconomyPortalPage = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [loadingData, setLoadingData] = useState(false);
  const [groupCustomers, setGroupCustomers] = useState<Customer[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  // Map of customer_id -> accessible site IDs for the current user.
  // For admins this is undefined per-customer (unrestricted).
  const [siteAccessByCustomer, setSiteAccessByCustomer] = useState<
    Record<string, string[] | undefined>
  >({});
  const [allSitesByCustomer, setAllSitesByCustomer] = useState<
    Record<string, PortalSite[]>
  >({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(ALL_CUSTOMERS);
  const [selectedSubclient, setSelectedSubclient] = useState<string>(ALL_SUBCLIENTS);
  const [selectedBrokerSiteId, setSelectedBrokerSiteId] = useState<string>(ALL_SITES);
  const [ownCustomerName, setOwnCustomerName] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setHasAccess(false);
        setGroupCustomers([]);
        setLoadingData(false);
        return;
      }
      setLoadingData(true);

      // 1) Find all Reconomy-group customers in the system
      const { data: allCustomers } = await supabase
        .from("customers")
        .select("id, customer_name, customer_code, is_broker")
        .order("customer_name");

      const group = (allCustomers ?? []).filter((c) =>
        matchesReconomy(c.customer_name),
      ) as Customer[];
      setGroupCustomers(group);

      if (group.length === 0) {
        setHasAccess(isAdmin);
        setLoadingData(false);
        return;
      }

      const groupIds = new Set(group.map((g) => g.id));

      // 2) Determine access
      let accessOk = false;
      const memberships: MembershipRow[] = [];
      if (isAdmin) {
        accessOk = true;
      } else {
        const { data: m } = await supabase
          .from("customer_portal_memberships")
          .select("id, customer_id, contact_id")
          .eq("user_id", user.id);
        (m ?? []).forEach((row) => {
          if (groupIds.has(row.customer_id)) {
            memberships.push(row as MembershipRow);
            accessOk = true;
          }
        });
        // Capture the user's own underlying customer name (e.g. "Reconomy (UK) Limited")
        const ownMembership = memberships[0];
        if (ownMembership) {
          const ownCustomer = group.find((c) => c.id === ownMembership.customer_id);
          if (ownCustomer) setOwnCustomerName(ownCustomer.customer_name);
        }
      }
      setHasAccess(accessOk);

      if (!accessOk) {
        setLoadingData(false);
        return;
      }

      // 3) Resolve sites + per-customer accessible site IDs
      const allSitesMap: Record<string, PortalSite[]> = {};
      const accessMap: Record<string, string[] | undefined> = {};

      // Pull all sites for the group customers (used by Site dropdown + admin view)
      const { data: sitesData } = await supabase
        .from("customer_sites")
        .select("id, site_name, broker_subclient, customer_id, owner_contact_id")
        .in("customer_id", Array.from(groupIds));

      const sitesByCustomer: Record<string, any[]> = {};
      (sitesData ?? []).forEach((s: any) => {
        const arr = sitesByCustomer[s.customer_id] ?? [];
        arr.push(s);
        sitesByCustomer[s.customer_id] = arr;
      });
      Object.entries(sitesByCustomer).forEach(([cid, arr]) => {
        allSitesMap[cid] = arr.map((s) => ({
          id: s.id,
          site_name: s.site_name,
          broker_subclient: s.broker_subclient ?? null,
        }));
      });
      setAllSitesByCustomer(allSitesMap);

      if (isAdmin) {
        // Admin: unrestricted per customer
        group.forEach((c) => {
          accessMap[c.id] = undefined;
        });
      } else if (memberships.length > 0) {
        // Reconomy is an umbrella group — if the user has a membership to ANY
        // Reconomy entity, grant broker-style access to ALL sub-brands so they
        // can switch between Circle Waste, Ecofficiency, AMA Waste, etc.
        group.forEach((c) => {
          accessMap[c.id] = (allSitesMap[c.id] ?? []).map((s) => s.id);
        });
      }
      setSiteAccessByCustomer(accessMap);
      setLoadingData(false);
    };

    load();
  }, [user, isAdmin]);

  const handleLogout = async () => {
    await signOut();
    setHasAccess(false);
  };

  // Customers that should appear in the dropdown / aggregate views.
  // For non-admins this is restricted to those they actually have access to.
  const visibleCustomers = useMemo(() => {
    const base = isAdmin
      ? groupCustomers
      : groupCustomers.filter((c) => siteAccessByCustomer[c.id] !== undefined);

    // Collapse "Reconomy (UK) Limited" + "Reconomy Solutions" into a single
    // virtual entry so the user sees one "Reconomy" sub-brand button.
    const coreReconomy = base.filter((c) => isReconomyCoreName(c.customer_name));
    if (coreReconomy.length === 0) return base;

    const others = base.filter((c) => !isReconomyCoreName(c.customer_name));
    const merged: Customer = {
      id: RECONOMY_MERGED_ID,
      customer_name: RECONOMY_MERGED_NAME,
      customer_code: coreReconomy.map((c) => c.customer_code).filter(Boolean).join(" / "),
      // Treat the merged entity as broker if any underlying entity is a broker.
      is_broker: coreReconomy.some((c) => !!c.is_broker),
    };
    return [merged, ...others];
  }, [groupCustomers, isAdmin, siteAccessByCustomer]);

  if (!loading && !user) {
    return <CustomerPortalLogin onLoginSuccess={() => {}} />;
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!hasAccess || visibleCustomers.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
              <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                Your account is not linked to the Reconomy portal. Please contact your account
                manager for access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </main>

      </div>
    );
  }

  // Selection state
  const isAggregate = selectedCustomerId === ALL_CUSTOMERS;
  // Expand the virtual merged "Reconomy" entry back into the real underlying
  // customer rows so all downstream data fetching works unchanged.
  const expandMerged = (cs: Customer[]): Customer[] =>
    cs.flatMap((c) =>
      c.id === RECONOMY_MERGED_ID
        ? groupCustomers.filter((g) => isReconomyCoreName(g.customer_name))
        : [c],
    );
  const customersInScope = isAggregate
    ? expandMerged(visibleCustomers)
    : expandMerged(visibleCustomers.filter((c) => c.id === selectedCustomerId));

  const storedTab = sessionStorage.getItem("reconomy-portal-active-tab");
  const defaultTab = storedTab || "site-reports";

  // Aggregate broker view: gather all sites across in-scope customers (only brokers)
  // since all Reconomy group entities are brokers, this powers the Sub-client/Site filters.
  const brokerSitesAll: (PortalSite & { customer_id: string })[] = customersInScope.flatMap((c) => {
    if (!c.is_broker) return [] as (PortalSite & { customer_id: string })[];
    const sites = allSitesByCustomer[c.id] ?? [];
    // Restrict by user access (admins are unrestricted -> undefined)
    const allowed = siteAccessByCustomer[c.id];
    const filtered = allowed === undefined ? sites : sites.filter((s) => allowed.includes(s.id));
    return filtered.map((s) => ({ ...s, customer_id: c.id }));
  });

  const subclients = Array.from(
    new Set(
      brokerSitesAll
        .map((s) => (s.broker_subclient || "").trim())
        .filter((s) => s.length > 0),
    ),
  ).sort();

  const sitesForSubclient =
    selectedSubclient === ALL_SUBCLIENTS
      ? brokerSitesAll
      : brokerSitesAll.filter((s) => (s.broker_subclient || "").trim() === selectedSubclient);

  const isBrokerView = brokerSitesAll.length > 0;

  // Effective per-customer accessible site IDs after broker dropdowns
  const effectiveAccessByCustomer: Record<string, string[] | undefined> = {};
  customersInScope.forEach((c) => {
    if (!isBrokerView || !c.is_broker) {
      effectiveAccessByCustomer[c.id] = siteAccessByCustomer[c.id];
      return;
    }
    let pool = brokerSitesAll.filter((s) => s.customer_id === c.id);
    if (selectedSubclient !== ALL_SUBCLIENTS) {
      pool = pool.filter((s) => (s.broker_subclient || "").trim() === selectedSubclient);
    }
    if (selectedBrokerSiteId !== ALL_SITES) {
      pool = pool.filter((s) => s.id === selectedBrokerSiteId);
    }
    effectiveAccessByCustomer[c.id] = pool.map((s) => s.id);
  });

  const renderPerCustomerSection = (
    title: string,
    body: (c: Customer) => React.ReactNode,
  ) => {
    // When a specific broker site is chosen, only render the customer that owns it
    const scope = isBrokerView && selectedBrokerSiteId !== ALL_SITES
      ? customersInScope.filter((c) => (effectiveAccessByCustomer[c.id]?.length ?? 0) > 0)
      : customersInScope;

    if (scope.length === 1) {
      return body(scope[0]);
    }
    return (
      <div className="space-y-6">
        {scope.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {c.customer_name}
              </CardTitle>
              <CardDescription>{title}</CardDescription>
            </CardHeader>
            <CardContent>{body(c)}</CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Layers className="h-3 w-3" />
                Reconomy Group Portal
              </span>
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
                  customerName={ownCustomerName || "Reconomy Group"}
                  managedSites={Object.values(allSitesByCustomer).flat()}
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
                <h1 className="text-2xl font-bold text-foreground">Reconomy Portal</h1>
                <p className="text-muted-foreground text-sm">
                  View activity across all Reconomy-group customers, or focus on one.
                </p>
              </div>
            </div>

          </div>

          {/* Sub-brand switcher: prominent buttons for each Reconomy umbrella entity */}
          <div className="mb-6">
            <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wide">
              Switch sub-brand
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCustomerId === ALL_CUSTOMERS ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCustomerId(ALL_CUSTOMERS);
                  setSelectedSubclient(ALL_SUBCLIENTS);
                  setSelectedBrokerSiteId(ALL_SITES);
                }}
                className="gap-2"
              >
                <Layers className="h-4 w-4" />
                All Reconomy Group
              </Button>
              {visibleCustomers.map((c) => (
                <Button
                  key={c.id}
                  variant={selectedCustomerId === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setSelectedSubclient(ALL_SUBCLIENTS);
                    setSelectedBrokerSiteId(ALL_SITES);
                  }}
                  className="gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  {c.customer_name}
                </Button>
              ))}
            </div>
          </div>

          {isBrokerView && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sub-client</label>
                <Select
                  value={selectedSubclient}
                  onValueChange={(v) => {
                    setSelectedSubclient(v);
                    setSelectedBrokerSiteId(ALL_SITES);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUBCLIENTS}>All sub-clients</SelectItem>
                    {subclients.map((sc) => (
                      <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Site</label>
                <Select value={selectedBrokerSiteId} onValueChange={setSelectedBrokerSiteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SITES}>All sites</SelectItem>
                    {sitesForSubclient.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Tabs
            defaultValue={defaultTab}
            onValueChange={(v) => sessionStorage.setItem("reconomy-portal-active-tab", v)}
            className="space-y-6"
          >
            <TabsList className="grid w-full max-w-2xl grid-cols-5">
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
              <TabsTrigger value="fuel-surcharges" className="flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                <span className="hidden sm:inline">Fuel Surcharges</span>
                <span className="sm:hidden">Fuel</span>
              </TabsTrigger>
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
              {renderPerCustomerSection("Site recycling and waste reports", (c) => (
                <CustomerPortalSiteReport
                  customerId={c.id}
                  customerName={c.customer_name}
                  accessibleSiteIds={effectiveAccessByCustomer[c.id]}
                  isBroker={!!c.is_broker}
                />
              ))}
            </TabsContent>

            <TabsContent value="rebate-reports">
              {renderPerCustomerSection("Rebate reports based on site pricing", (c) => (
                <CustomerPortalRebateReport
                  customerId={c.id}
                  customerName={c.customer_name}
                  accessibleSiteIds={effectiveAccessByCustomer[c.id]}
                />
              ))}
            </TabsContent>

            <TabsContent value="fuel-surcharges">
              {renderPerCustomerSection("Fuel surcharges applied to your jobs", (c) => (
                <CustomerPortalFuelSurcharges
                  customerId={c.id}
                  customerName={c.customer_name}
                  accessibleSiteIds={effectiveAccessByCustomer[c.id]}
                />
              ))}
            </TabsContent>

            <TabsContent value="bookings">
              {renderPerCustomerSection("Bookings and service activity", (c) => (
                <CustomerPortalServices
                  customerId={c.id}
                  customerName={c.customer_name}
                  accessibleSiteIds={effectiveAccessByCustomer[c.id]}
                />
              ))}
            </TabsContent>

            <TabsContent value="contact">
              {customersInScope.length === 1 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Customer Service</CardTitle>
                    <CardDescription>
                      Send a request or enquiry to our customer service team
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CustomerPortalContactForm
                      customerId={customersInScope[0].id}
                      customerName={customersInScope[0].customer_name}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Customer Service</CardTitle>
                    <CardDescription>
                      Choose which Reconomy customer this enquiry relates to, then send your
                      message.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use the customer selector at the top of the page to pick a single customer
                      before sending an enquiry.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ReconomyPortalPage;
