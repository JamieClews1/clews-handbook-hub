import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Eye, Calendar, Container, ArrowRightLeft, Truck, Package, Clock, Search } from "lucide-react";
import { format, subMonths, startOfMonth, differenceInDays } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  scheduled: "bg-purple-100 text-purple-800 border-purple-300",
  in_progress: "bg-orange-100 text-orange-800 border-orange-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

const TIME_SLOTS = ["AM (8:00-12:00)", "PM (12:00-17:00)", "All Day"];
const CONTAINER_TYPES = ["4yd Skip", "6yd Skip", "8yd Skip", "12yd Skip", "14yd Skip", "16yd Skip", "20yd RORO", "30yd RORO", "40yd RORO", "FEL 660L", "FEL 1100L", "Cage"];

type Booking = {
  id: string;
  booking_reference: string;
  site_id: string | null;
  collection_date: string | null;
  collection_time_slot: string | null;
  container_type: string | null;
  waste_type: string | null;
  quantity: number | null;
  status: string;
  special_instructions: string | null;
  created_at: string;
};

type OnSiteContainer = {
  siteName: string;
  containerType: string;
  wasteType: string;
  count: number;
  lastActivityDate: string | null;
  lastJobNumber: string | null;
  daysOnSite: number;
};

type DataHubJob = {
  site: string | null;
  container_type: string | null;
  waste_description: string | null;
  movement_type: string | null;
  job_date: string | null;
  job_number: string | null;
};

interface Props {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

type RequestType = "new" | "exchange" | "collection";

export const CustomerPortalServices = ({ customerId, customerName, accessibleSiteIds }: Props) => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sites, setSites] = useState<{ id: string; site_name: string; data_hub_site: string | null; data_hub_site_2: string | null; data_hub_site_3: string | null; data_hub_site_4: string | null; data_hub_site_5: string | null; data_hub_customer: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [onSiteContainers, setOnSiteContainers] = useState<OnSiteContainer[]>([]);
  const [loadingOnSite, setLoadingOnSite] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("new");
  const [prefillSite, setPrefillSite] = useState("");
  const [prefillContainer, setPrefillContainer] = useState("");
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [form, setForm] = useState({
    site_id: "",
    collection_date: "",
    collection_time_slot: "",
    container_type: "",
    waste_type: "",
    quantity: 1,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    special_instructions: "",
  });

  useEffect(() => {
    fetchData();
  }, [customerId, accessibleSiteIds]);

  const fetchData = async () => {
    setLoading(true);
    setLoadingOnSite(true);

    // Load accessible sites
    let siteQuery = supabase.from("customer_sites").select("id, site_name, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, data_hub_customer").eq("customer_id", customerId);
    if (accessibleSiteIds && accessibleSiteIds.length > 0) {
      siteQuery = siteQuery.in("id", accessibleSiteIds);
    }
    const { data: sitesData } = await siteQuery.order("site_name");
    const loadedSites = sitesData ?? [];
    setSites(loadedSites);

    // Load bookings
    const siteIds = accessibleSiteIds && accessibleSiteIds.length > 0
      ? accessibleSiteIds
      : loadedSites.map(s => s.id);

    if (siteIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, booking_reference, site_id, collection_date, collection_time_slot, container_type, waste_type, quantity, status, special_instructions, created_at")
        .in("site_id", siteIds)
        .order("created_at", { ascending: false });
      setBookings((bookingsData as Booking[]) ?? []);
    } else {
      setBookings([]);
    }
    setLoading(false);

    // Load on-site containers from data_hub_jobs
    await fetchOnSiteContainers(loadedSites);
  };

  const fetchOnSiteContainers = async (loadedSites: typeof sites) => {
    // Build list of data_hub site names to search for
    const siteAliases: { siteName: string; dataHubNames: string[] }[] = [];
    for (const s of loadedSites) {
      const names: string[] = [];
      // Include all data_hub_site fields (up to 5 aliases per site)
      for (const field of [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]) {
        if (field && !names.includes(field)) names.push(field);
      }
      // Also try site_name as fallback
      if (!names.includes(s.site_name)) names.push(s.site_name);
      if (names.length > 0) siteAliases.push({ siteName: s.site_name, dataHubNames: names });
    }

    if (siteAliases.length === 0) {
      setOnSiteContainers([]);
      setLoadingOnSite(false);
      return;
    }

    const allDataHubNames = siteAliases.flatMap(a => a.dataHubNames);
    const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

    // Fetch skiptrak jobs for these sites
    let allJobs: DataHubJob[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("site, container_type, waste_description, movement_type, job_date, job_number")
        .eq("source", "skiptrak")
        .gte("job_date", since)
        .in("movement_type", ["Deliver", "Exchange", "Collect"])
        .in("site", allDataHubNames)
        .order("job_date", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) break;
      allJobs = allJobs.concat((data ?? []) as DataHubJob[]);
      hasMore = (data?.length ?? 0) === pageSize;
      from += pageSize;
    }

    // Compute on-site per site + container type
    // Logic: net = delivers - collects. Exchanges prove a container is on site (swap old for new).
    // If net <= 0 but there are recent exchanges, at least 1 container is still on site.
    const containerMap: Record<string, { delivered: number; collected: number; exchanges: number; lastActivity: string | null; lastMovement: string | null; lastJobNumber: string | null }> = {};

    for (const job of allJobs) {
      if (!job.site || !job.container_type) continue;
      const alias = siteAliases.find(a => a.dataHubNames.some(n => n.toLowerCase() === job.site!.toLowerCase()));
      if (!alias) continue;

      const wasteDesc = job.waste_description || "Unknown";
      const key = `${alias.siteName}|||${job.container_type}|||${wasteDesc}`;
      if (!containerMap[key]) {
        containerMap[key] = { delivered: 0, collected: 0, exchanges: 0, lastActivity: null, lastMovement: null, lastJobNumber: null };
      }

      // Track latest activity date and movement type
      if (job.job_date && (!containerMap[key].lastActivity || job.job_date > containerMap[key].lastActivity!)) {
        containerMap[key].lastActivity = job.job_date;
        containerMap[key].lastMovement = job.movement_type;
        containerMap[key].lastJobNumber = job.job_number;
      }

      if (job.movement_type === "Deliver") {
        containerMap[key].delivered++;
      } else if (job.movement_type === "Exchange") {
        containerMap[key].exchanges++;
      } else if (job.movement_type === "Collect") {
        containerMap[key].collected++;
      }
    }

    const results: OnSiteContainer[] = [];
    for (const [key, val] of Object.entries(containerMap)) {
      let netCount = val.delivered - val.collected;

      // If there are exchanges and last movement wasn't a standalone collect,
      // there's at least 1 container on site
      if (netCount <= 0 && val.exchanges > 0 && val.lastMovement !== "Collect") {
        netCount = 1;
      }

      if (netCount <= 0) continue;
      const [siteName, containerType, wasteType] = key.split("|||");
      const days = val.lastActivity ? differenceInDays(new Date(), new Date(val.lastActivity)) : 0;
      results.push({
        siteName,
        containerType,
        wasteType,
        count: netCount,
        lastActivityDate: val.lastActivity,
        lastJobNumber: val.lastJobNumber,
        daysOnSite: days,
      });
    }

    // Sort by site name then container type
    results.sort((a, b) => a.siteName.localeCompare(b.siteName) || a.containerType.localeCompare(b.containerType));
    setOnSiteContainers(results);
    setLoadingOnSite(false);
  };

  const getSiteName = (id: string | null) =>
    sites.find(s => s.id === id)?.site_name || "—";

  const upcomingBookings = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return bookings.filter(b =>
      b.collection_date && b.collection_date >= today &&
      !["completed", "cancelled"].includes(b.status) &&
      (siteFilter === "all" || b.site_id === siteFilter)
    ).sort((a, b) => (a.collection_date || "").localeCompare(b.collection_date || ""));
  }, [bookings, siteFilter]);

  const filteredOnSite = useMemo(() => {
    if (siteFilter === "all") return onSiteContainers;
    const siteName = sites.find(s => s.id === siteFilter)?.site_name;
    if (!siteName) return onSiteContainers;
    return onSiteContainers.filter(c => c.siteName === siteName);
  }, [onSiteContainers, siteFilter, sites]);

  const filteredBookingsHistory = useMemo(() => {
    const nonUpcoming = bookings.filter(b => !upcomingBookings.includes(b));
    if (siteFilter === "all") return nonUpcoming;
    return nonUpcoming.filter(b => b.site_id === siteFilter);
  }, [bookings, upcomingBookings, siteFilter]);

  const openRequestDialog = (type: RequestType, site?: string, container?: string, wasteType?: string) => {
    setRequestType(type);
    setPrefillSite(site || "");
    setPrefillContainer(container || "");

    // Try to find site_id from site name
    const matchedSite = site ? sites.find(s => s.site_name === site) : null;
    setForm({
      site_id: matchedSite?.id || "",
      collection_date: "",
      collection_time_slot: "",
      container_type: container || "",
      waste_type: wasteType || "",
      quantity: 1,
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      special_instructions: "",
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.site_id) {
      toast({ title: "Please select a site", variant: "destructive" });
      return;
    }

    const { error, data } = await supabase.from("bookings").insert({
      customer_id: customerId,
      site_id: form.site_id,
      collection_date: form.collection_date || null,
      collection_time_slot: form.collection_time_slot || null,
      container_type: form.container_type || null,
      waste_type: form.waste_type || null,
      quantity: form.quantity,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      special_instructions: form.special_instructions || null,
      source: "portal",
      status: "pending" as const,
    } as any).select("booking_reference").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Send email notification to orders
    const siteName = sites.find(s => s.id === form.site_id)?.site_name || "Unknown";
    try {
      await supabase.functions.invoke("booking-notification", {
        body: {
          requestType,
          customerName,
          siteName,
          containerType: form.container_type || "Not specified",
          wasteType: form.waste_type || "Not specified",
          preferredDate: form.collection_date || null,
          specialInstructions: form.special_instructions || null,
          bookingReference: (data as any)?.booking_reference || "—",
        },
      });
    } catch (e) {
      console.error("Failed to send notification:", e);
    }

    const typeLabel = requestType === "exchange" ? "Exchange" : requestType === "collection" ? "Collection" : "Service";
    toast({ title: `${typeLabel} request submitted`, description: "We'll confirm your request shortly." });
    setCreateOpen(false);
    fetchData();
  };

  const totalOnSite = filteredOnSite.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Site Filter */}
      {sites.length > 1 && (
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Container className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loadingOnSite ? "—" : totalOnSite}</p>
              <p className="text-xs text-muted-foreground">Containers On Site</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingBookings.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming Services</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openRequestDialog("new")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">New Service Request</p>
              <p className="text-xs text-muted-foreground">Book a collection or delivery</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* On-Site Containers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            What's On Your Sites
          </CardTitle>
          <CardDescription>Current containers at your locations based on recent activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOnSite ? (
            <div className="text-center py-6 text-muted-foreground">Loading on-site data...</div>
          ) : filteredOnSite.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No containers currently on site.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Waste Type</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOnSite.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.siteName}</TableCell>
                    <TableCell>{c.containerType}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.wasteType}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{c.count}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{c.lastActivityDate ? format(new Date(c.lastActivityDate + "T00:00:00"), "dd/MM/yyyy") : "—"}</span>
                          <span className={`text-xs ${c.daysOnSite > 28 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            ({c.daysOnSite}d ago)
                          </span>
                        </div>
                        {c.lastJobNumber && (
                          <span className="text-xs text-muted-foreground font-mono">{c.lastJobNumber}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => openRequestDialog("exchange", c.siteName, c.containerType, c.wasteType)}
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          Exchange
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => openRequestDialog("collection", c.siteName, c.containerType, c.wasteType)}
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          Collect
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Scheduled Services */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Services
              </CardTitle>
              <CardDescription>Scheduled collections and deliveries</CardDescription>
            </div>
            <Button size="sm" onClick={() => openRequestDialog("new")}>
              <Plus className="h-4 w-4 mr-1" /> New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6 text-muted-foreground">Loading...</div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No upcoming services scheduled. Click "New Request" to book one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingBookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono font-medium text-sm">{b.booking_reference}</TableCell>
                    <TableCell>{getSiteName(b.site_id)}</TableCell>
                    <TableCell>{b.collection_date ? format(new Date(b.collection_date + "T00:00:00"), "dd/MM/yyyy") : "TBC"}</TableCell>
                    <TableCell className="text-sm">{b.collection_time_slot || "TBC"}</TableCell>
                    <TableCell>{b.container_type || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>{b.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setViewBooking(b)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Bookings History */}
      {filteredBookingsHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Booking History</CardTitle>
            <CardDescription>All past and current bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookingsHistory.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono font-medium text-sm">{b.booking_reference}</TableCell>
                    <TableCell>{getSiteName(b.site_id)}</TableCell>
                    <TableCell>{b.collection_date ? format(new Date(b.collection_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>{b.container_type || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>{b.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setViewBooking(b)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Request Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {requestType === "exchange" ? "Request Exchange" : requestType === "collection" ? "Request Collection" : "New Service Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={form.site_id} onValueChange={v => setForm({ ...form, site_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preferred Date</Label>
                <Input type="date" value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={form.collection_time_slot} onValueChange={v => setForm({ ...form, collection_time_slot: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Container Type</Label>
                <Select value={form.container_type} onValueChange={v => setForm({ ...form, container_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {CONTAINER_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Waste Type</Label>
                <Input value={form.waste_type} onChange={e => setForm({ ...form, waste_type: e.target.value })} placeholder="e.g. General Waste" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Textarea value={form.special_instructions} onChange={e => setForm({ ...form, special_instructions: e.target.value })} rows={2} placeholder="Access requirements, specific location on site, etc." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Submit Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {viewBooking?.booking_reference}
            </DialogTitle>
          </DialogHeader>
          {viewBooking && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={STATUS_COLORS[viewBooking.status] || ""}>{viewBooking.status.replace("_", " ")}</Badge>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Site</span><span>{getSiteName(viewBooking.site_id)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Collection Date</span><span>{viewBooking.collection_date ? format(new Date(viewBooking.collection_date + "T00:00:00"), "dd/MM/yyyy") : "TBC"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time Slot</span><span>{viewBooking.collection_time_slot || "TBC"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Container</span><span>{viewBooking.container_type || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Waste Type</span><span>{viewBooking.waste_type || "—"}</span></div>
              {viewBooking.special_instructions && (
                <div>
                  <span className="text-muted-foreground">Special Instructions</span>
                  <p className="mt-1 p-2 bg-muted rounded">{viewBooking.special_instructions}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Submitted {format(new Date(viewBooking.created_at), "dd/MM/yyyy HH:mm")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
