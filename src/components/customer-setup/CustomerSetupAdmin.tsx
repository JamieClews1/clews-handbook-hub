import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { UserCheck, MapPin, Key, UserPlus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { SiteRebateItemsEditor } from "./SiteRebateItemsEditor";
import { SiteRebateOverridesEditor } from "./SiteRebateOverridesEditor";
import { DataHubCombobox } from "./DataHubCombobox";
import { SiteSkipRebatesEditor } from "./SiteSkipRebatesEditor";
import { CustomerSkipRebatesEditor } from "./CustomerSkipRebatesEditor";
import { StaciPalletRatesEditor } from "./StaciPalletRatesEditor";
import { CustomerReportingPeriodsEditor } from "./CustomerReportingPeriodsEditor";
import { CreditApplicationsManager } from "./CreditApplicationsManager";
import { Switch } from "@/components/ui/switch";
import { SitePriceSetScheduleEditor } from "./SitePriceSetScheduleEditor";
import { selectActivePriceSetLink } from "@/lib/rebate-price-set";

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  po_notification_email: string | null;
  custom_reporting_periods_enabled: boolean;
  is_broker: boolean;
  is_active: boolean;
  data_hub_customer: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
  broker_subclient: string | null;
  owner_contact_id: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerContact = {
  id: string;
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

type PriceSet = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type SitePriceSet = {
  id: string;
  site_id: string;
  price_set_id: string;
  created_at: string;
  updated_at: string;
};

type Membership = {
  id: string;
  customer_id: string;
  user_id: string;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLite = {
  id: string;
  email: string;
  full_name: string | null;
};

export function CustomerSetupAdmin() {
  const { toast } = useToast();

  // Radix Select disallows SelectItem value="" (empty string). We use a sentinel
  // to represent clearing a selection while still allowing Select's value to be "".
  const SELECT_NONE_VALUE = "__none__";

  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [priceSets, setPriceSets] = useState<PriceSet[]>([]);
  const [sitePriceSets, setSitePriceSets] = useState<Record<string, SitePriceSet | undefined>>({});

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [siteAccessByMembershipId, setSiteAccessByMembershipId] = useState<Record<string, Set<string>>>({});

  // dialogs
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState({ customer_code: "", customer_name: "", po_notification_email: "", custom_reporting_periods_enabled: false, is_broker: false });

  const customerCreateSchema = useMemo(
    () =>
      z.object({
        customer_code: z.string().trim().min(1, "Customer code is required.").max(50, "Customer code is too long."),
        customer_name: z.string().trim().min(1, "Customer name is required.").max(150, "Customer name is too long."),
      }),
    []
  );

  const [editSiteOpen, setEditSiteOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerSite | null>(null);
  const [siteForm, setSiteForm] = useState({
    site_name: "",
    data_hub_customer: "",
    data_hub_site: "",
    data_hub_site_2: "",
    data_hub_site_3: "",
    data_hub_site_4: "",
    data_hub_site_5: "",
    broker_subclient: "",
    owner_contact_id: "",
    price_set_id: "",
    load_report_type: "",
  });
  const [savingSite, setSavingSite] = useState(false);
  // Human-readable window (e.g. "01/05/2026 → ongoing") of the period whose rebate values are shown below.
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState<string | null>(null);
  const [newRebateSetInline, setNewRebateSetInline] = useState("");
  const [skiptrakCustomers, setSkiptrakCustomers] = useState<string[]>([]);
  const [skiptrakSitesByCustomer, setSkiptrakSitesByCustomer] = useState<Record<string, string[]>>({});
  const [skiptrakAllSites, setSkiptrakAllSites] = useState<string[]>([]);
  const [loadingSkiptrak, setLoadingSkiptrak] = useState(false);

  const loadSkiptrakOptions = async () => {
    if (skiptrakCustomers.length > 0 || loadingSkiptrak) return;
    setLoadingSkiptrak(true);
    try {
      // Fetch distinct customer/site pairs from Skiptrak data
      const pageSize = 1000;
      let from = 0;
      const all: { customer: string | null; site: string | null }[] = [];
      // Loop through pages until exhausted
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("customer, site")
          .eq("source", "skiptrak")
          .not("customer", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
        if (from > 200000) break; // safety
      }
      const custSet = new Set<string>();
      const siteSet = new Set<string>();
      const sitesByCust: Record<string, Set<string>> = {};
      for (const row of all) {
        const c = (row.customer || "").trim();
        const s = (row.site || "").trim();
        if (c) custSet.add(c);
        if (s) siteSet.add(s);
        if (c && s) {
          if (!sitesByCust[c]) sitesByCust[c] = new Set();
          sitesByCust[c].add(s);
        }
      }
      setSkiptrakCustomers(Array.from(custSet).sort());
      setSkiptrakAllSites(Array.from(siteSet).sort());
      const map: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(sitesByCust)) map[k] = Array.from(v).sort();
      setSkiptrakSitesByCustomer(map);
    } catch (err) {
      console.error("Failed to load Skiptrak options", err);
    } finally {
      setLoadingSkiptrak(false);
    }
  };



  // Available load report types - matches CustomerTypeSelector options
  const LOAD_REPORT_TYPES = [
    { id: "britvic", name: "Britvic" },
    { id: "staci", name: "Staci" },
    { id: "vantiva", name: "Weighbridge Load" },
    { id: "amazon", name: "Amazon" },
    { id: "evri", name: "EVRi" },
    { id: "other", name: "Standard" },
  ];

  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [contactForm, setContactForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    contact_id: "",
  });
  const [inviting, setInviting] = useState(false);

  // Password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordUserEmail, setPasswordUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  // Create portal login state (for contacts without portal access)
  const [creatingPortalLogin, setCreatingPortalLogin] = useState(false);

  const [syncingBrokerSites, setSyncingBrokerSites] = useState(false);

  const normalizeBrokerName = (value: string) =>
    value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[.,'"]/g, " ")
      .replace(/\b(limited|ltd|plc|llp)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const syncBrokerSitesFromSkiptrak = async () => {
    if (!selectedCustomer || !selectedCustomerId) return;
    const brokerName = selectedCustomer.customer_name?.trim();
    if (!brokerName) {
      toast({ title: "Missing customer name", description: "Cannot sync without a customer name.", variant: "destructive" });
      return;
    }
    setSyncingBrokerSites(true);
    try {
      const normalizedBroker = normalizeBrokerName(brokerName);
      const searchPrefix = brokerName.replace(/\b(limited|ltd|plc|llp)\b/gi, " ").replace(/\s+/g, " ").trim() || brokerName;

      // Fetch all Skiptrak rows whose customer name approximately matches the broker
      const pageSize = 1000;
      let from = 0;
      const allRows: { customer: string | null; site: string | null }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("customer, site")
          .eq("source", "skiptrak")
          .not("site", "is", null)
          .ilike("customer", `${searchPrefix}%`)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
        if (from > 200000) break;
      }

      // Filter strictly to rows where normalized customer name matches the broker
      const matchedSites = new Set<string>();
      const matchedCustomers = new Set<string>();
      for (const row of allRows) {
        const c = (row.customer || "").trim();
        const s = (row.site || "").trim();
        if (!c || !s) continue;
        if (normalizeBrokerName(c) !== normalizedBroker) continue;
        matchedSites.add(s);
        matchedCustomers.add(c);
      }

      if (matchedSites.size === 0) {
        toast({ title: "No Skiptrak sites found", description: `No Skiptrak jobs were found for "${brokerName}".`, variant: "destructive" });
        return;
      }

      // Determine which sites are already present (case-insensitive name match)
      const existingNames = new Set(sites.map((s) => s.site_name.trim().toLowerCase()));
      const customerAlias = Array.from(matchedCustomers)[0] ?? brokerName;
      const toInsert = Array.from(matchedSites)
        .filter((siteName) => !existingNames.has(siteName.toLowerCase()))
        .map((siteName) => ({
          customer_id: selectedCustomerId,
          site_name: siteName,
          data_hub_customer: customerAlias,
          data_hub_site: siteName,
        }));

      if (toInsert.length === 0) {
        toast({ title: "Already in sync", description: `All ${matchedSites.size} Skiptrak site(s) for this broker are already added.` });
        return;
      }

      const { error: insertError } = await supabase.from("customer_sites").insert(toInsert);
      if (insertError) throw insertError;

      toast({
        title: "Broker sites synced",
        description: `Added ${toInsert.length} new site(s) from Skiptrak. Skipped ${matchedSites.size - toInsert.length} already present.`,
      });
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Sync failed", description: e?.message ?? "Failed to sync broker sites.", variant: "destructive" });
    } finally {
      setSyncingBrokerSites(false);
    }
  };


  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c) => {
      if (!showArchived && !c.is_active) return false;
      if (!q) return true;
      const code = c.customer_code.toLowerCase();
      const name = c.customer_name.toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [customers, customerSearch, showArchived]);

  const contactsById = useMemo(() => {
    const map: Record<string, CustomerContact> = {};
    for (const c of contacts) map[c.id] = c;
    return map;
  }, [contacts]);

  // Map contact_id -> membership (to find the linked portal user for a contact)
  const membershipByContactId = useMemo(() => {
    const map: Record<string, Membership> = {};
    for (const m of memberships) {
      if (m.contact_id) map[m.contact_id] = m;
    }
    return map;
  }, [memberships]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id,customer_code,customer_name,po_notification_email,custom_reporting_periods_enabled,is_broker,is_active,data_hub_customer,created_at,updated_at")
      .order("customer_name", { ascending: true });
    if (error) throw error;
    setCustomers((data ?? []) as Customer[]);
    if (!selectedCustomerId && (data?.[0]?.id ?? null)) {
      setSelectedCustomerId(data![0]!.id);
    }
  };

  const loadCustomerDetails = async (customerId: string) => {
    const [{ data: sitesData, error: sitesError }, { data: contactsData, error: contactsError }, { data: priceSetsData, error: priceSetsError }, { data: membershipsData, error: membershipsError }] =
      await Promise.all([
        supabase
          .from("customer_sites")
          .select("id,customer_id,site_name,data_hub_customer,data_hub_site,data_hub_site_2,data_hub_site_3,data_hub_site_4,data_hub_site_5,broker_subclient,owner_contact_id,load_report_type,created_at,updated_at")
          .eq("customer_id", customerId)
          .order("site_name", { ascending: true }),
        supabase
          .from("customer_contacts")
          .select("id,customer_id,full_name,email,phone,created_at,updated_at")
          .eq("customer_id", customerId)
          .order("full_name", { ascending: true }),
        supabase.from("rebate_price_sets").select("id,name,created_at,updated_at").order("name", { ascending: true }),
        supabase
          .from("customer_portal_memberships")
          .select("id,customer_id,user_id,contact_id,created_at,updated_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

    if (sitesError) throw sitesError;
    if (contactsError) throw contactsError;
    if (priceSetsError) throw priceSetsError;
    if (membershipsError) throw membershipsError;

    const s = (sitesData ?? []) as CustomerSite[];
    setSites(s);
    setContacts((contactsData ?? []) as CustomerContact[]);
    setPriceSets((priceSetsData ?? []) as PriceSet[]);
    setMemberships((membershipsData ?? []) as Membership[]);

    // site -> price set
    if (s.length > 0) {
      const { data: sitePriceSetRows, error: sitePriceSetError } = await supabase
        .from("customer_site_price_sets")
        .select("id,site_id,price_set_id,effective_from,effective_to,created_at,updated_at")
        .in(
          "site_id",
          s.map((x) => x.id)
        );
      if (sitePriceSetError) throw sitePriceSetError;
      const today = new Date().toISOString().slice(0, 10);
      const grouped: Record<string, any[]> = {};
      for (const row of (sitePriceSetRows ?? []) as any[]) {
        (grouped[row.site_id] ??= []).push(row);
      }
      const map: Record<string, SitePriceSet | undefined> = {};
      for (const [sid, list] of Object.entries(grouped)) {
        // Use the assignment active today as the site's "current" price set.
        map[sid] = (selectActivePriceSetLink(list, today) as SitePriceSet) ?? undefined;
      }
      setSitePriceSets(map);
    } else {
      setSitePriceSets({});
    }
  };

  // Reload only the list of rebate sets (used after periods create dedicated sets).
  const reloadPriceSets = async () => {
    const { data, error } = await supabase
      .from("rebate_price_sets")
      .select("id,name,created_at,updated_at")
      .order("name", { ascending: true });
    if (!error) setPriceSets((data ?? []) as PriceSet[]);
  };



  const loadMembershipDetails = async (membershipRows: Membership[], siteRows: CustomerSite[]) => {
    // profiles
    const userIds = Array.from(new Set(membershipRows.map((m) => m.user_id)));
    if (userIds.length === 0) {
      setProfilesById({});
      setSiteAccessByMembershipId({});
      return;
    }

    const [{ data: profiles, error: profilesError }, { data: accessRows, error: accessError }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name").in("id", userIds),
      supabase
        .from("customer_portal_site_access")
        .select("membership_id,site_id")
        .in(
          "membership_id",
          membershipRows.map((m) => m.id)
        ),
    ]);
    if (profilesError) throw profilesError;
    if (accessError) throw accessError;

    const profileMap: Record<string, ProfileLite> = {};
    for (const p of (profiles ?? []) as ProfileLite[]) {
      profileMap[p.id] = p;
    }
    setProfilesById(profileMap);

    const accessMap: Record<string, Set<string>> = {};
    for (const m of membershipRows) accessMap[m.id] = new Set<string>();
    for (const r of (accessRows ?? []) as Array<{ membership_id: string; site_id: string }>) {
      accessMap[r.membership_id] ??= new Set();
      accessMap[r.membership_id]!.add(r.site_id);
    }

    // Include implicit owner-based access so existing access shows as ticked.
    // Portal visibility = explicit site access UNION sites the user's contact owns.
    for (const m of membershipRows) {
      if (!m.contact_id) continue;
      for (const s of siteRows) {
        if (s.owner_contact_id && s.owner_contact_id === m.contact_id) {
          accessMap[m.id]!.add(s.id);
        }
      }
    }

    // Ensure sites exist (defensive)
    const siteIds = new Set(siteRows.map((x) => x.id));
    for (const mId of Object.keys(accessMap)) {
      accessMap[mId] = new Set(Array.from(accessMap[mId] ?? []).filter((sid) => siteIds.has(sid)));
    }
    setSiteAccessByMembershipId(accessMap);
  };

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      await loadCustomers();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message ?? "Failed to load customers.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!selectedCustomerId) return;
      setIsLoading(true);
      try {
        await loadCustomerDetails(selectedCustomerId);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message ?? "Failed to load customer details.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [selectedCustomerId, toast]);

  useEffect(() => {
    const load = async () => {
      if (!selectedCustomerId) return;
      try {
        await loadMembershipDetails(memberships, sites);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message ?? "Failed to load portal access details.",
          variant: "destructive",
        });
      }
    };
    load();
  }, [memberships, sites, selectedCustomerId, toast]);

  const openCreateSite = () => {
    setEditingSite(null);
    setSiteForm({
      site_name: "",
      data_hub_customer: "",
      data_hub_site: "",
      data_hub_site_2: "",
      data_hub_site_3: "",
      data_hub_site_4: "",
      data_hub_site_5: "",
      broker_subclient: "",
      owner_contact_id: "",
      price_set_id: "",
      load_report_type: "",
    });
    setNewRebateSetInline("");
    setSelectedPeriodLabel(null);
    setEditSiteOpen(true);
    loadSkiptrakOptions();
  };

  const openEditSite = (site: CustomerSite & { load_report_type?: string | null }) => {
    setEditingSite(site);
    const existingPriceSetId = sitePriceSets[site.id]?.price_set_id ?? "";
    setSiteForm({
      site_name: site.site_name ?? "",
      data_hub_customer: site.data_hub_customer ?? "",
      data_hub_site: site.data_hub_site ?? "",
      data_hub_site_2: site.data_hub_site_2 ?? "",
      data_hub_site_3: site.data_hub_site_3 ?? "",
      data_hub_site_4: site.data_hub_site_4 ?? "",
      data_hub_site_5: site.data_hub_site_5 ?? "",
      broker_subclient: (site as any).broker_subclient ?? "",
      owner_contact_id: site.owner_contact_id ?? "",
      price_set_id: existingPriceSetId,
      load_report_type: (site as any).load_report_type ?? "",
    });
    setNewRebateSetInline("");
    setSelectedPeriodLabel(null);
    setEditSiteOpen(true);
    loadSkiptrakOptions();
  };

  const saveSite = async () => {
    if (!selectedCustomerId) return;
    if (!siteForm.site_name.trim()) {
      toast({ title: "Missing site name", description: "Please enter a site name.", variant: "destructive" });
      return;
    }

    setSavingSite(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        site_name: siteForm.site_name.trim(),
        data_hub_customer: siteForm.data_hub_customer.trim() || null,
        data_hub_site: siteForm.data_hub_site.trim() || null,
        data_hub_site_2: siteForm.data_hub_site_2.trim() || null,
        data_hub_site_3: siteForm.data_hub_site_3.trim() || null,
        data_hub_site_4: siteForm.data_hub_site_4.trim() || null,
        data_hub_site_5: siteForm.data_hub_site_5.trim() || null,
        broker_subclient: siteForm.broker_subclient.trim() || null,
        owner_contact_id: siteForm.owner_contact_id || null,
        load_report_type: siteForm.load_report_type || null,
      };

      let siteId: string;
      if (editingSite) {
        const { error } = await supabase.from("customer_sites").update(payload).eq("id", editingSite.id);
        if (error) throw error;
        siteId = editingSite.id;
      } else {
        const { data, error } = await supabase.from("customer_sites").insert(payload).select("id").single();
        if (error) throw error;
        siteId = data.id;
      }

      // Handle rebate set assignment
      const priceSetIdToUse = siteForm.price_set_id || null;
      await setSitePriceSet(siteId, priceSetIdToUse);

      toast({ title: editingSite ? "Saved" : "Created", description: editingSite ? "Site updated." : "Site created." });
      setEditSiteOpen(false);
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save site.", variant: "destructive" });
    } finally {
      setSavingSite(false);
    }
  };

  const deleteSite = async (siteId: string) => {
    if (!selectedCustomerId) return;
    if (!confirm("Delete this site? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("customer_sites").delete().eq("id", siteId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Site removed." });
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete site.", variant: "destructive" });
    }
  };

  const openCreateContact = () => {
    setEditingContact(null);
    setContactForm({ full_name: "", email: "", phone: "" });
    setEditContactOpen(true);
  };

  const openEditContact = (contact: CustomerContact) => {
    setEditingContact(contact);
    setContactForm({
      full_name: contact.full_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
    });
    setEditContactOpen(true);
  };

  const saveContact = async () => {
    if (!selectedCustomerId) return;
    if (!contactForm.full_name.trim()) {
      toast({ title: "Missing name", description: "Please enter a contact name.", variant: "destructive" });
      return;
    }

    setSavingContact(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        full_name: contactForm.full_name.trim(),
        email: contactForm.email.trim() ? contactForm.email.trim() : null,
        phone: contactForm.phone.trim() ? contactForm.phone.trim() : null,
      };

      if (editingContact) {
        const { error } = await supabase.from("customer_contacts").update(payload).eq("id", editingContact.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Contact updated." });
      } else {
        const { error } = await supabase.from("customer_contacts").insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: "Contact created." });
      }

      setEditContactOpen(false);
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save contact.", variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!selectedCustomerId) return;
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Contact removed." });
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete contact.", variant: "destructive" });
    }
  };

  const createCustomer = async () => {
    const parsed = customerCreateSchema.safeParse({
      customer_code: newCustomerCode,
      customer_name: newCustomerName,
    });
    if (!parsed.success) {
      toast({
        title: "Check customer details",
        description: parsed.error.issues[0]?.message ?? "Invalid customer details.",
        variant: "destructive",
      });
      return;
    }

    const { customer_code: code, customer_name: name } = parsed.data;
    setSavingCustomer(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({ customer_code: code, customer_name: name })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Created", description: `Customer ${name} created.` });
      setCreateCustomerOpen(false);
      setNewCustomerCode("");
      setNewCustomerName("");
      await loadCustomers();
      if (data?.id) setSelectedCustomerId(data.id);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create customer.", variant: "destructive" });
    } finally {
      setSavingCustomer(false);
    }
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomerForm({ 
      customer_code: customer.customer_code, 
      customer_name: customer.customer_name,
      po_notification_email: customer.po_notification_email || "orders@clewsrecycling.co.uk",
      custom_reporting_periods_enabled: customer.custom_reporting_periods_enabled ?? false,
      is_broker: customer.is_broker ?? false,
    });
    setEditCustomerOpen(true);
  };

  const saveCustomer = async () => {
    if (!editingCustomer) return;
    const parsed = customerCreateSchema.safeParse(editCustomerForm);
    if (!parsed.success) {
      toast({
        title: "Check customer details",
        description: parsed.error.issues[0]?.message ?? "Invalid customer details.",
        variant: "destructive",
      });
      return;
    }

    setSavingCustomer(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ 
          customer_code: parsed.data.customer_code, 
          customer_name: parsed.data.customer_name,
          po_notification_email: editCustomerForm.po_notification_email.trim() || null,
          custom_reporting_periods_enabled: editCustomerForm.custom_reporting_periods_enabled,
          is_broker: editCustomerForm.is_broker,
        })
        .eq("id", editingCustomer.id);
      if (error) throw error;
      toast({ title: "Saved", description: "Customer updated." });
      setEditCustomerOpen(false);
      setEditingCustomer(null);
      await loadCustomers();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save customer.", variant: "destructive" });
    } finally {
      setSavingCustomer(false);
    }
  };

  const setSitePriceSet = async (siteId: string, priceSetId: string | null) => {
    try {
      const existing = sitePriceSets[siteId];
      if (!priceSetId) {
        if (existing) {
          const { error } = await supabase.from("customer_site_price_sets").delete().eq("id", existing.id);
          if (error) throw error;
        }
        setSitePriceSets((prev) => ({ ...prev, [siteId]: undefined }));
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from("customer_site_price_sets")
          .update({ price_set_id: priceSetId })
          .eq("id", existing.id);
        if (error) throw error;
        setSitePriceSets((prev) => ({
          ...prev,
          [siteId]: { ...existing, price_set_id: priceSetId },
        }));
      } else {
        const { data, error } = await supabase
          .from("customer_site_price_sets")
          .insert({ site_id: siteId, price_set_id: priceSetId })
          .select("id,site_id,price_set_id,created_at,updated_at")
          .single();
        if (error) throw error;
        if (data) setSitePriceSets((prev) => ({ ...prev, [siteId]: data as SitePriceSet }));
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to set price-set.", variant: "destructive" });
    }
  };

  const openInvite = () => {
    setInviteForm({ email: "", full_name: "", contact_id: "" });
    setInviteOpen(true);
  };

  const inviteAndLink = async () => {
    if (!selectedCustomerId) return;
    const email = inviteForm.email.trim();
    if (!email) {
      toast({ title: "Missing email", description: "Email is required.", variant: "destructive" });
      return;
    }
    if (!inviteForm.contact_id) {
      toast({ title: "Missing contact", description: "Select the contact to link this login to.", variant: "destructive" });
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          full_name: inviteForm.full_name.trim() ? inviteForm.full_name.trim() : null,
          user_types: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const userId: string | undefined = data?.user?.id ?? data?.id ?? undefined;
      if (!userId) {
        throw new Error("User was created but no user id was returned.");
      }

      const { error: membershipError } = await supabase.from("customer_portal_memberships").insert({
        customer_id: selectedCustomerId,
        user_id: userId,
        contact_id: inviteForm.contact_id,
      });
      if (membershipError) throw membershipError;

      toast({ title: "Invited", description: "Portal login created and linked." });
      setInviteOpen(false);
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to invite and link portal user.", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const toggleSiteAccess = (membershipId: string, siteId: string, checked: boolean) => {
    setSiteAccessByMembershipId((prev) => {
      const next = { ...prev };
      next[membershipId] = new Set(next[membershipId] ?? []);
      if (checked) next[membershipId]!.add(siteId);
      else next[membershipId]!.delete(siteId);
      return next;
    });
  };

  const saveSiteAccess = async (membershipId: string) => {
    try {
      const allowed = Array.from(siteAccessByMembershipId[membershipId] ?? []);
      // simplest safe approach: replace rows
      const { error: delError } = await supabase.from("customer_portal_site_access").delete().eq("membership_id", membershipId);
      if (delError) throw delError;
      if (allowed.length > 0) {
        const { error: insError } = await supabase.from("customer_portal_site_access").insert(
          allowed.map((site_id) => ({ membership_id: membershipId, site_id }))
        );
        if (insError) throw insError;
      }
      toast({ title: "Saved", description: "Site access updated." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save site access.", variant: "destructive" });
    }
  };

  const openPasswordDialog = (userId: string, email: string) => {
    setPasswordUserId(userId);
    setPasswordUserEmail(email);
    setNewPassword("");
    setPasswordDialogOpen(true);
  };

  const setUserPassword = async () => {
    if (!passwordUserId || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Invalid password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setSettingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("set-user-password", {
        body: { user_id: passwordUserId, password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Password updated", description: `Password set for ${passwordUserEmail}` });
      setPasswordDialogOpen(false);
      setNewPassword("");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to set password.", variant: "destructive" });
    } finally {
      setSettingPassword(false);
    }
  };

  // Create a portal login for a contact who doesn't have one yet
  const createPortalLoginForContact = async (contact: CustomerContact) => {
    if (!selectedCustomerId || !contact.email) {
      toast({ 
        title: "Missing email", 
        description: "Contact must have an email address to create portal login.", 
        variant: "destructive" 
      });
      return;
    }

    setCreatingPortalLogin(true);
    try {
      // Create the auth user via edge function
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: contact.email.trim(),
          full_name: contact.full_name.trim() || null,
          user_types: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const userId: string | undefined = data?.user?.id ?? data?.id ?? undefined;
      if (!userId) {
        throw new Error("User was created but no user id was returned.");
      }

      // Create the membership linked to this contact
      const { error: membershipError } = await supabase.from("customer_portal_memberships").insert({
        customer_id: selectedCustomerId,
        user_id: userId,
        contact_id: contact.id,
      });
      if (membershipError) throw membershipError;

      toast({ title: "Portal login created", description: `Login created for ${contact.email}. You can now set their password.` });
      
      // Reload to get the new membership
      await loadCustomerDetails(selectedCustomerId);
      
      // Open password dialog for the new user
      openPasswordDialog(userId, contact.email);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create portal login.", variant: "destructive" });
    } finally {
      setCreatingPortalLogin(false);
    }
  };

  const createRebateSetInline = async () => {
    const name = newRebateSetInline.trim();
    if (!name) {
      toast({ title: "Missing name", description: "Please enter a rebate set name.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.from("rebate_price_sets").insert({ name }).select("id,name,created_at,updated_at").single();
      if (error) throw error;
      toast({ title: "Created", description: "Rebate set created." });
      setPriceSets((prev) => [...prev, data as PriceSet].sort((a, b) => a.name.localeCompare(b.name)));
      setSiteForm((p) => ({ ...p, price_set_id: data.id }));
      setNewRebateSetInline("");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create rebate set.", variant: "destructive" });
    }
  };

  const removeMembership = async (membershipId: string) => {
    if (!selectedCustomerId) return;
    if (!confirm("Remove this portal membership?")) return;
    try {
      const { error } = await supabase.from("customer_portal_memberships").delete().eq("id", membershipId);
      if (error) throw error;
      toast({ title: "Removed", description: "Portal membership removed." });
      await loadCustomerDetails(selectedCustomerId);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove membership.", variant: "destructive" });
    }
  };

  return (
    <Tabs defaultValue="customers" className="w-full">
      <TabsList>
        <TabsTrigger value="customers">Customers</TabsTrigger>
        <TabsTrigger value="new-customers">New customers</TabsTrigger>
      </TabsList>

      <TabsContent value="customers" className="mt-4">
        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Select a customer to manage sites, contacts, and portal access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customers..."
            />
            <Button variant="outline" onClick={() => setCreateCustomerOpen(true)}>
              New
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
            <Label htmlFor="show-archived" className="text-muted-foreground cursor-pointer">Show archived</Label>
            <span className="ml-auto text-xs text-muted-foreground">{filteredCustomers.length} customers</span>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((c) => (
                    <TableRow
                      key={c.id}
                      className={c.id === selectedCustomerId ? "bg-muted/40" : ""}
                      onClick={() => setSelectedCustomerId(c.id)}
                      role="button"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {c.customer_name}
                          {!c.is_active && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">Archived</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">No customers found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Button variant="ghost" onClick={refreshAll} disabled={isLoading} className="w-full">
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Customer</CardTitle>
              <CardDescription>
                {selectedCustomer ? (
                  <span>
                    Managing <span className="font-medium text-foreground">{selectedCustomer.customer_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({selectedCustomer.customer_code})</span>
                  </span>
                ) : (
                  "Select a customer to begin."
                )}
              </CardDescription>
            </div>
            {selectedCustomer && (
              <Button variant="outline" size="sm" onClick={() => openEditCustomer(selectedCustomer)}>
                Edit customer
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCustomer ? (
              <div className="text-sm text-muted-foreground">No customer selected.</div>
            ) : (
              <Tabs defaultValue="sites" className="w-full">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="sites">Sites</TabsTrigger>
                  <TabsTrigger value="midweigh">Midweigh Rebates</TabsTrigger>
                  {selectedCustomer.customer_name.toLowerCase().includes("staci") && (
                    <TabsTrigger value="staci-rates">Staci Rates</TabsTrigger>
                  )}
                   <TabsTrigger value="contacts">Contacts</TabsTrigger>
                   <TabsTrigger value="portal">Portal access</TabsTrigger>
                   {selectedCustomer.custom_reporting_periods_enabled && (
                     <TabsTrigger value="reporting-periods">Reporting Periods</TabsTrigger>
                   )}
                </TabsList>

                <TabsContent value="sites" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Sites</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedCustomer.is_broker
                          ? "Broker account: use 'Sync Sites from Skiptrak' to auto-add every site assigned to this broker in Skiptrak."
                          : "Create sites, manually attach Data Hub identifiers, set an owner contact, and pick a rebate price-set template."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.is_broker && (
                        <Button
                          variant="outline"
                          onClick={syncBrokerSitesFromSkiptrak}
                          disabled={syncingBrokerSites}
                        >
                          {syncingBrokerSites ? "Syncing…" : "Sync Sites from Skiptrak"}
                        </Button>
                      )}
                      <Button onClick={openCreateSite}>New site</Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Site</TableHead>
                          <TableHead>Load Report Type</TableHead>
                          <TableHead>Owner contact</TableHead>
                          <TableHead>Data Hub customer</TableHead>
                          <TableHead>Rebate Set</TableHead>
                          <TableHead className="w-[180px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sites.map((s) => {
                          const owner = s.owner_contact_id ? contactsById[s.owner_contact_id] : null;
                          const priceSetId = sitePriceSets[s.id]?.price_set_id ?? "";
                          const priceSet = priceSets.find((ps) => ps.id === priceSetId);
                          const loadReportType = (s as any).load_report_type;
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{s.site_name}</TableCell>
                              <TableCell>
                                {loadReportType ? (
                                  <Badge variant="secondary">{loadReportType.toUpperCase()}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>{owner ? owner.full_name : <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>{s.data_hub_customer ?? <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>
                                {priceSet ? (
                                  <span className="text-sm">{priceSet.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEditSite(s)}>
                                    Edit
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => deleteSite(s.id)}>
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {sites.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-muted-foreground">
                              No sites yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="midweigh" className="mt-4 space-y-4">
                  <CustomerSkipRebatesEditor
                    customerId={selectedCustomerId!}
                    customerName={selectedCustomer?.customer_name ?? ""}
                  />
                </TabsContent>

                <TabsContent value="contacts" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Contacts</h3>
                      <p className="text-sm text-muted-foreground">Contacts can be used as site owners and can also be given portal logins.</p>
                    </div>
                    <Button onClick={openCreateContact}>New contact</Button>
                  </div>

                  <div className="grid gap-4">
                    {contacts.map((c) => {
                      const membership = membershipByContactId[c.id];
                      const hasPortalAccess = !!membership;
                      const profile = membership ? profilesById[membership.user_id] : null;
                      const managedSites = sites.filter((s) => s.owner_contact_id === c.id);

                      return (
                        <Card key={c.id} className="relative">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between gap-4">
                              {/* Contact info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-foreground">{c.full_name}</h4>
                                  {hasPortalAccess && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <UserCheck className="h-3 w-3" />
                                      Portal Access
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-0.5">
                                  {c.email && <p>{c.email}</p>}
                                  {c.phone && <p>{c.phone}</p>}
                                </div>

                                {/* Managed sites */}
                                {managedSites.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Manages sites:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {managedSites.map((site) => (
                                        <Badge key={site.id} variant="outline" className="text-xs">
                                          <MapPin className="h-3 w-3 mr-1" />
                                          {site.site_name}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Portal login info */}
                                {hasPortalAccess && profile && (
                                  <div className="mt-2 p-2 bg-muted/50 rounded-md">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Portal Login:</p>
                                    <p className="text-sm">{profile.email}</p>
                                  </div>
                                )}
                              </div>

                              {/* Actions - right side */}
                              <div className="flex flex-col gap-2 items-end">
                                <div className="flex items-center gap-1">
                                  {hasPortalAccess ? (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Set Password"
                                      onClick={() => {
                                        openPasswordDialog(membership.user_id, profile?.email ?? membership.user_id);
                                      }}
                                    >
                                      <Key className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    c.email && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs gap-1"
                                        disabled={creatingPortalLogin}
                                        onClick={() => createPortalLoginForContact(c)}
                                        title="Create portal login"
                                      >
                                        <UserPlus className="h-3 w-3" />
                                        Create Login
                                      </Button>
                                    )
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Edit contact"
                                    onClick={() => openEditContact(c)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Delete contact"
                                    onClick={() => deleteContact(c.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {contacts.length === 0 && (
                      <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground text-center">
                          No contacts yet.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="portal" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Portal access</h3>
                      <p className="text-sm text-muted-foreground">Invite contacts as portal users and assign which sites they can access.</p>
                    </div>
                    <Button onClick={openInvite} disabled={contacts.length === 0}>
                      Invite portal user
                    </Button>
                  </div>

                  {contacts.length === 0 && (
                    <Card>
                      <CardContent className="py-6 text-sm text-muted-foreground">
                        Create at least one contact first (Contacts tab), then you can invite them as a portal user.
                      </CardContent>
                    </Card>
                  )}

                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Linked contact</TableHead>
                          <TableHead>Sites</TableHead>
                          <TableHead className="w-[240px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberships.map((m) => {
                          const profile = profilesById[m.user_id];
                          const contact = m.contact_id ? contactsById[m.contact_id] : null;
                          const allowed = siteAccessByMembershipId[m.id] ?? new Set<string>();
                          const allowedLabel = allowed.size === 0 ? "None" : `${allowed.size} site(s)`;

                          return (
                            <TableRow key={m.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{profile?.email ?? m.user_id}</span>
                                  {profile?.full_name && <span className="text-xs text-muted-foreground">{profile.full_name}</span>}
                                </div>
                              </TableCell>
                              <TableCell>{contact ? contact.full_name : <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>
                                <span className="text-sm">{allowedLabel}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" onClick={() => saveSiteAccess(m.id)}>
                                    Save access
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => removeMembership(m.id)}>
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {memberships.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              No portal users linked yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {memberships.length > 0 && (
                    <div className="space-y-4">
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold">Edit site access</h4>
                        <p className="text-sm text-muted-foreground">Tick sites for each portal user, then click “Save access”.</p>
                      </div>

                      <div className="space-y-6">
                        {memberships.map((m) => {
                          const profile = profilesById[m.user_id];
                          const allowed = siteAccessByMembershipId[m.id] ?? new Set<string>();
                          return (
                            <Card key={`access-${m.id}`}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">{profile?.email ?? m.user_id}</CardTitle>
                                <CardDescription>Select site access for this user.</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {sites.map((s) => (
                                    <label key={`${m.id}-${s.id}`} className="flex items-center gap-2 rounded-md border border-border p-3">
                                      <Checkbox
                                        checked={allowed.has(s.id)}
                                        onCheckedChange={(v) => toggleSiteAccess(m.id, s.id, Boolean(v))}
                                      />
                                      <span className="text-sm">{s.site_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {selectedCustomer.custom_reporting_periods_enabled && (
                  <TabsContent value="reporting-periods" className="mt-4">
                    <CustomerReportingPeriodsEditor
                      customerId={selectedCustomer.id}
                      customerName={selectedCustomer.customer_name}
                    />
                  </TabsContent>
                )}

                <TabsContent value="staci-rates" className="mt-4">
                  <StaciPalletRatesEditor />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        </div>
        </div>
      </TabsContent>

      <TabsContent value="new-customers" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            <CreditApplicationsManager />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Create customer dialog */}
      <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>Create a customer using the unique customer code and a required name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer name</Label>
              <Input
                id="customer_name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="e.g. Britvic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_code">Customer code</Label>
              <Input
                id="customer_code"
                value={newCustomerCode}
                onChange={(e) => setNewCustomerCode(e.target.value)}
                placeholder="e.g. BRITVIC"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCustomerOpen(false)} disabled={savingCustomer}>
              Cancel
            </Button>
            <Button onClick={createCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit customer dialog */}
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update the customer details and notification settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_customer_name">Customer name</Label>
              <Input
                id="edit_customer_name"
                value={editCustomerForm.customer_name}
                onChange={(e) => setEditCustomerForm((p) => ({ ...p, customer_name: e.target.value }))}
                placeholder="e.g. Britvic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_customer_code">Customer code</Label>
              <Input
                id="edit_customer_code"
                value={editCustomerForm.customer_code}
                onChange={(e) => setEditCustomerForm((p) => ({ ...p, customer_code: e.target.value }))}
                placeholder="e.g. BRITVIC"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="edit_po_notification_email">PO Change Notification Email</Label>
              <Input
                id="edit_po_notification_email"
                type="email"
                value={editCustomerForm.po_notification_email}
                onChange={(e) => setEditCustomerForm((p) => ({ ...p, po_notification_email: e.target.value }))}
                placeholder="orders@clewsrecycling.co.uk"
              />
              <p className="text-xs text-muted-foreground">
                When a customer edits a PO number in the portal, a notification will be sent to this email address.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Custom Reporting Periods</Label>
                <p className="text-xs text-muted-foreground">
                  Enable unique reporting periods for portal users (e.g. Biffa-style periods).
                </p>
              </div>
              <Switch
                checked={editCustomerForm.custom_reporting_periods_enabled}
                onCheckedChange={(v) => setEditCustomerForm((p) => ({ ...p, custom_reporting_periods_enabled: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Broker account</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this customer as a broker (e.g. Project Waste). Their portal users will see a Sub-client → Site dropdown to filter the sites they manage.
                </p>
              </div>
              <Switch
                checked={editCustomerForm.is_broker}
                onCheckedChange={(v) => setEditCustomerForm((p) => ({ ...p, is_broker: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomerOpen(false)} disabled={savingCustomer}>
              Cancel
            </Button>
            <Button onClick={saveCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site dialog */}
      <Dialog open={editSiteOpen} onOpenChange={setEditSiteOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit site" : "New site"}</DialogTitle>
            <DialogDescription>Configure site details, Data Hub mapping, and rebate pricing.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="site_name">Site name</Label>
              <Input
                id="site_name"
                value={siteForm.site_name}
                onChange={(e) => setSiteForm((p) => ({ ...p, site_name: e.target.value }))}
                placeholder="e.g. Britvic Rugby"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dh_customer">Data Hub customer</Label>
                <DataHubCombobox
                  value={siteForm.data_hub_customer}
                  onChange={(v) => setSiteForm((p) => ({ ...p, data_hub_customer: v }))}
                  options={skiptrakCustomers}
                  placeholder={loadingSkiptrak ? "Loading Skiptrak data…" : "Select or type customer"}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Data Hub sites (up to 5)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                {siteForm.data_hub_customer
                  ? `Showing sites for "${siteForm.data_hub_customer}". Type to add a new value.`
                  : "Showing all Skiptrak sites. Pick a Data Hub customer above to narrow down."}
              </p>
              {(() => {
                const siteOptions = siteForm.data_hub_customer && skiptrakSitesByCustomer[siteForm.data_hub_customer]
                  ? skiptrakSitesByCustomer[siteForm.data_hub_customer]
                  : skiptrakAllSites;
                const slots: Array<keyof typeof siteForm> = [
                  "data_hub_site",
                  "data_hub_site_2",
                  "data_hub_site_3",
                  "data_hub_site_4",
                  "data_hub_site_5",
                ];
                return (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {slots.map((key, idx) => (
                      <DataHubCombobox
                        key={key}
                        value={(siteForm[key] as string) || ""}
                        onChange={(v) => setSiteForm((p) => ({ ...p, [key]: v }))}
                        options={siteOptions}
                        placeholder={`Site ${idx + 1}`}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>

            {selectedCustomer?.is_broker && (
              <div className="grid gap-2">
                <Label htmlFor="broker_subclient">Sub-client (broker grouping)</Label>
                <Input
                  id="broker_subclient"
                  value={siteForm.broker_subclient}
                  onChange={(e) => setSiteForm((p) => ({ ...p, broker_subclient: e.target.value }))}
                  placeholder="e.g. ACME Ltd"
                />
                <p className="text-xs text-muted-foreground">
                  Used in the broker's portal to group sites by end-client.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Owner contact</Label>
              <Select
                value={siteForm.owner_contact_id}
                onValueChange={(val) =>
                  setSiteForm((p) => ({
                    ...p,
                    owner_contact_id: val === SELECT_NONE_VALUE ? "" : val,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label>Load Report Type</Label>
              <Select
                value={siteForm.load_report_type}
                onValueChange={(val) =>
                  setSiteForm((p) => ({
                    ...p,
                    load_report_type: val === SELECT_NONE_VALUE ? "" : val,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select load report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {LOAD_REPORT_TYPES.map((lrt) => (
                    <SelectItem key={lrt.id} value={lrt.id}>
                      {lrt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines which materials appear for rebate values.</p>
            </div>

            <div className="grid gap-2">
              <Label>Rebate Set</Label>
              <Select
                value={siteForm.price_set_id}
                onValueChange={(val) =>
                  setSiteForm((p) => ({
                    ...p,
                    price_set_id: val === SELECT_NONE_VALUE ? "" : val,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rebate set (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {priceSets.map((ps) => (
                    <SelectItem key={ps.id} value={ps.id}>
                      {ps.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Assign a rebate pricing template to this site.</p>
            </div>

            <div className="grid gap-2">
              <Label>Or create new rebate set</Label>
              <div className="flex gap-2">
                <Input
                  value={newRebateSetInline}
                  onChange={(e) => setNewRebateSetInline(e.target.value)}
                  placeholder="e.g. Merchant Price Card"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={createRebateSetInline}
                  disabled={!newRebateSetInline.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Effective-dated rebate charging periods (only when editing an existing site) */}
            {editingSite && (
              <>
                <Separator />
                <SitePriceSetScheduleEditor
                  siteId={editingSite.id}
                  priceSets={priceSets}
                  selectedPriceSetId={siteForm.price_set_id}
                  onSelectPeriod={(id, label) => {
                    setSiteForm((p) => ({ ...p, price_set_id: id }));
                    setSelectedPeriodLabel(label ?? null);
                  }}
                  onPriceSetsChanged={reloadPriceSets}
                />
              </>
            )}

            {/* Rebate Items Configuration - only show if a rebate set and load report type are selected */}
            {siteForm.price_set_id && siteForm.load_report_type && (
              <>
                <Separator />
                {editingSite && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold">
                      Editing rebate values for
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPeriodLabel ? `Period ${selectedPeriodLabel} · ` : ""}
                      {priceSets.find((ps) => ps.id === siteForm.price_set_id)?.name ?? "this rebate set"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Changes here only affect this period. Pick a different period above to edit another model.
                    </p>
                  </div>
                )}

                <SiteRebateItemsEditor
                  priceSetId={siteForm.price_set_id}
                  priceSetName={priceSets.find((ps) => ps.id === siteForm.price_set_id)?.name ?? "Rebate Set"}
                  loadReportType={siteForm.load_report_type}
                />
                {editingSite && (
                  <>
                    <Separator />
                    <SiteRebateOverridesEditor siteId={editingSite.id} siteName={siteForm.site_name || "this site"} />
                  </>
                )}
              </>
            )}
            {siteForm.price_set_id && !siteForm.load_report_type && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                Select a Load Report Type above to configure rebate values for materials.
              </p>
            )}

            {/* Skip/RoRo Rebates - show when editing a site, or placeholder when creating */}
            <Separator />
            {editingSite ? (
              <SiteSkipRebatesEditor
                siteId={editingSite.id}
                siteName={siteForm.site_name || editingSite.site_name}
              />
            ) : (
              <div className="space-y-2">
                <Label className="text-base font-medium">Skip / RoRo Rebates</Label>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  Save this site first to configure Skip/RoRo rebates.
                </p>
              </div>
            )}
          </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSiteOpen(false)} disabled={savingSite}>
              Cancel
            </Button>
            <Button onClick={saveSite} disabled={savingSite}>
              {savingSite ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={editContactOpen} onOpenChange={setEditContactOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit contact" : "New contact"}</DialogTitle>
            <DialogDescription>Create a contact record. You can later invite them as a portal user.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contact_name">Full name</Label>
              <Input
                id="contact_name"
                value={contactForm.full_name}
                onChange={(e) => setContactForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@customer.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+44..."
                />
              </div>
            </div>
          </div>

          {/* Portal Access section */}
          {editingContact && (
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Portal Access</p>
                  {membershipByContactId[editingContact.id] ? (
                    <p className="text-xs text-muted-foreground">
                      This contact has a linked portal login ({profilesById[membershipByContactId[editingContact.id].user_id]?.email ?? "user"})
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No portal login exists for this contact
                    </p>
                  )}
                </div>
                {membershipByContactId[editingContact.id] ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const membership = membershipByContactId[editingContact.id];
                      const profile = profilesById[membership.user_id];
                      openPasswordDialog(membership.user_id, profile?.email ?? membership.user_id);
                    }}
                  >
                    Set Password
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={creatingPortalLogin || !editingContact.email}
                    onClick={() => createPortalLoginForContact(editingContact)}
                  >
                    {creatingPortalLogin ? "Creating..." : "Create Portal Login"}
                  </Button>
                )}
              </div>
            </div>
          )}


          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContactOpen(false)} disabled={savingContact}>
              Cancel
            </Button>
            <Button onClick={saveContact} disabled={savingContact}>
              {savingContact ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Invite portal user</DialogTitle>
            <DialogDescription>Create a login and link it to an existing customer contact.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))} placeholder="name@customer.com" />
            </div>
            <div className="grid gap-2">
              <Label>Full name (optional)</Label>
              <Input value={inviteForm.full_name} onChange={(e) => setInviteForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Shown in profile" />
            </div>
            <div className="grid gap-2">
              <Label>Link to contact</Label>
              <Select value={inviteForm.contact_id} onValueChange={(val) => setInviteForm((p) => ({ ...p, contact_id: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} {c.email ? `(${c.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={inviteAndLink} disabled={inviting}>
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set password dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium">{passwordUserEmail}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={settingPassword}>
              Cancel
            </Button>
            <Button onClick={setUserPassword} disabled={settingPassword || newPassword.length < 6}>
              {settingPassword ? "Setting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Tabs>
  );
}
