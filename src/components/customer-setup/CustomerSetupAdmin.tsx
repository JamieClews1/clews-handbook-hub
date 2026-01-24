import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

type Customer = {
  id: string;
  customer_code: string;
  created_at: string;
  updated_at: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
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
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [editSiteOpen, setEditSiteOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerSite | null>(null);
  const [siteForm, setSiteForm] = useState({
    site_name: "",
    data_hub_customer: "",
    data_hub_site: "",
    owner_contact_id: "",
  });
  const [savingSite, setSavingSite] = useState(false);

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

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.customer_code.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const contactsById = useMemo(() => {
    const map: Record<string, CustomerContact> = {};
    for (const c of contacts) map[c.id] = c;
    return map;
  }, [contacts]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id,customer_code,created_at,updated_at")
      .order("customer_code", { ascending: true });
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
          .select("id,customer_id,site_name,data_hub_customer,data_hub_site,owner_contact_id,created_at,updated_at")
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
        .select("id,site_id,price_set_id,created_at,updated_at")
        .in(
          "site_id",
          s.map((x) => x.id)
        );
      if (sitePriceSetError) throw sitePriceSetError;
      const map: Record<string, SitePriceSet | undefined> = {};
      for (const row of (sitePriceSetRows ?? []) as SitePriceSet[]) {
        map[row.site_id] = row;
      }
      setSitePriceSets(map);
    } else {
      setSitePriceSets({});
    }
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
      owner_contact_id: "",
    });
    setEditSiteOpen(true);
  };

  const openEditSite = (site: CustomerSite) => {
    setEditingSite(site);
    setSiteForm({
      site_name: site.site_name ?? "",
      data_hub_customer: site.data_hub_customer ?? "",
      data_hub_site: site.data_hub_site ?? "",
      owner_contact_id: site.owner_contact_id ?? "",
    });
    setEditSiteOpen(true);
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
        data_hub_customer: siteForm.data_hub_customer.trim() ? siteForm.data_hub_customer.trim() : null,
        data_hub_site: siteForm.data_hub_site.trim() ? siteForm.data_hub_site.trim() : null,
        owner_contact_id: siteForm.owner_contact_id ? siteForm.owner_contact_id : null,
      };

      if (editingSite) {
        const { error } = await supabase.from("customer_sites").update(payload).eq("id", editingSite.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Site updated." });
      } else {
        const { error } = await supabase.from("customer_sites").insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: "Site created." });
      }

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
    const code = newCustomerCode.trim();
    if (!code) {
      toast({ title: "Missing code", description: "Customer code is required.", variant: "destructive" });
      return;
    }
    setSavingCustomer(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({ customer_code: code })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Created", description: `Customer ${code} created.` });
      setCreateCustomerOpen(false);
      setNewCustomerCode("");
      await loadCustomers();
      if (data?.id) setSelectedCustomerId(data.id);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create customer.", variant: "destructive" });
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
              placeholder="Search by customer code..."
            />
            <Button variant="outline" onClick={() => setCreateCustomerOpen(true)}>
              New
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
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
                      <TableCell className="font-medium">{c.customer_code}</TableCell>
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
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>
              {selectedCustomer ? (
                <span>
                  Managing <span className="font-medium text-foreground">{selectedCustomer.customer_code}</span>
                </span>
              ) : (
                "Select a customer to begin."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCustomer ? (
              <div className="text-sm text-muted-foreground">No customer selected.</div>
            ) : (
              <Tabs defaultValue="sites" className="w-full">
                <TabsList>
                  <TabsTrigger value="sites">Sites</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="portal">Portal access</TabsTrigger>
                </TabsList>

                <TabsContent value="sites" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Sites</h3>
                      <p className="text-sm text-muted-foreground">Create sites, manually attach Data Hub identifiers, set an owner contact, and pick a rebate price-set template.</p>
                    </div>
                    <Button onClick={openCreateSite}>New site</Button>
                  </div>

                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Site</TableHead>
                          <TableHead>Owner contact</TableHead>
                          <TableHead>Data Hub customer</TableHead>
                          <TableHead>Data Hub site</TableHead>
                          <TableHead>Price-set</TableHead>
                          <TableHead className="w-[220px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sites.map((s) => {
                          const owner = s.owner_contact_id ? contactsById[s.owner_contact_id] : null;
                          const priceSetId = sitePriceSets[s.id]?.price_set_id ?? "";
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{s.site_name}</TableCell>
                              <TableCell>{owner ? owner.full_name : <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>{s.data_hub_customer ?? <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>{s.data_hub_site ?? <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>
                                <Select
                                  value={priceSetId}
                                  onValueChange={(val) => setSitePriceSet(s.id, val === SELECT_NONE_VALUE ? null : val)}
                                >
                                  <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Select..." />
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

                <TabsContent value="contacts" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Contacts</h3>
                      <p className="text-sm text-muted-foreground">Contacts can be used as site owners and can also be given portal logins.</p>
                    </div>
                    <Button onClick={openCreateContact}>New contact</Button>
                  </div>

                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead className="w-[220px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.full_name}</TableCell>
                            <TableCell>{c.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>{c.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditContact(c)}>
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => deleteContact(c.id)}>
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {contacts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              No contacts yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
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
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create customer dialog */}
      <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>Create a customer using the unique customer code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="customer_code">Customer code</Label>
            <Input
              id="customer_code"
              value={newCustomerCode}
              onChange={(e) => setNewCustomerCode(e.target.value)}
              placeholder="e.g. BRITVIC"
            />
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

      {/* Site dialog */}
      <Dialog open={editSiteOpen} onOpenChange={setEditSiteOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit site" : "New site"}</DialogTitle>
            <DialogDescription>Manual Data Hub mapping is optional. Owner is a contact record.</DialogDescription>
          </DialogHeader>
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
                <Input
                  id="dh_customer"
                  value={siteForm.data_hub_customer}
                  onChange={(e) => setSiteForm((p) => ({ ...p, data_hub_customer: e.target.value }))}
                  placeholder="Exact string in uploads"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dh_site">Data Hub site</Label>
                <Input
                  id="dh_site"
                  value={siteForm.data_hub_site}
                  onChange={(e) => setSiteForm((p) => ({ ...p, data_hub_site: e.target.value }))}
                  placeholder="Exact string in uploads"
                />
              </div>
            </div>

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
          </div>
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
    </div>
  );
}
