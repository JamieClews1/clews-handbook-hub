import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Filter, Eye, Edit2, Trash2, Calendar, Truck } from "lucide-react";
import { format } from "date-fns";

type Booking = {
  id: string;
  booking_reference: string;
  customer_id: string | null;
  site_id: string | null;
  booking_date: string;
  collection_date: string | null;
  collection_time_slot: string | null;
  container_type: string | null;
  waste_type: string | null;
  quantity: number | null;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  special_instructions: string | null;
  internal_notes: string | null;
  assigned_driver: string | null;
  vehicle_reg: string | null;
  source: string | null;
  created_at: string;
};

type Customer = { id: string; customer_name: string; customer_code: string };
type Site = { id: string; site_name: string; customer_id: string };

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  scheduled: "bg-purple-100 text-purple-800 border-purple-300",
  in_progress: "bg-orange-100 text-orange-800 border-orange-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

const TIME_SLOTS = ["AM (8:00-12:00)", "PM (12:00-17:00)", "All Day", "Specific Time"];
const CONTAINER_TYPES = ["4yd Skip", "6yd Skip", "8yd Skip", "12yd Skip", "14yd Skip", "16yd Skip", "20yd RORO", "30yd RORO", "40yd RORO", "FEL 660L", "FEL 1100L", "Cage"];
const STATUSES = ["pending", "confirmed", "scheduled", "in_progress", "completed", "cancelled"];

const emptyForm = {
  customer_id: "",
  site_id: "",
  collection_date: "",
  collection_time_slot: "",
  container_type: "",
  waste_type: "",
  quantity: 1,
  status: "pending" as string,
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  special_instructions: "",
  internal_notes: "",
  assigned_driver: "",
  vehicle_reg: "",
};

export const BookingsManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [latestSkiptrak, setLatestSkiptrak] = useState<Record<string, string>>({});

  const filteredSites = form.customer_id
    ? sites.filter((s) => s.customer_id === form.customer_id)
    : sites;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [bRes, cRes, sRes] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, customer_name, customer_code").eq("is_active", true).order("customer_name"),
      supabase.from("customer_sites").select("id, site_name, customer_id, data_hub_site").order("site_name"),
    ]);
    if (bRes.data) setBookings(bRes.data as Booking[]);
    if (cRes.data) setCustomers(cRes.data);
    if (sRes.data) setSites(sRes.data);

    // Fetch latest skiptrak job number per site
    if (bRes.data && sRes.data) {
      const siteIds = [...new Set(bRes.data.map((b: any) => b.site_id).filter(Boolean))];
      const siteMap = new Map(sRes.data.map((s: any) => [s.id, s.data_hub_site]));
      const dhSites = siteIds.map((id) => siteMap.get(id)).filter(Boolean) as string[];
      
      if (dhSites.length > 0) {
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
          .select("job_number, site, job_date")
          .eq("source", "skiptrak")
          .in("site", dhSites)
          .order("job_date", { ascending: false })
          .limit(500);
        
        if (jobs) {
          // Build map: data_hub_site -> latest job_number
          const siteJobMap: Record<string, string> = {};
          for (const j of jobs) {
            if (j.site && !siteJobMap[j.site]) {
              siteJobMap[j.site] = j.job_number;
            }
          }
          // Convert to site_id -> job_number
          const result: Record<string, string> = {};
          for (const [siteId, dhSite] of siteMap.entries()) {
            if (dhSite && siteJobMap[dhSite]) {
              result[siteId] = siteJobMap[dhSite];
            }
          }
          setLatestSkiptrak(result);
        }
      }
    }

    setLoading(false);
  };

  const openCreate = () => {
    setEditingBooking(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: Booking) => {
    setEditingBooking(b);
    setForm({
      customer_id: b.customer_id || "",
      site_id: b.site_id || "",
      collection_date: b.collection_date || "",
      collection_time_slot: b.collection_time_slot || "",
      container_type: b.container_type || "",
      waste_type: b.waste_type || "",
      quantity: b.quantity || 1,
      status: b.status,
      contact_name: b.contact_name || "",
      contact_email: b.contact_email || "",
      contact_phone: b.contact_phone || "",
      special_instructions: b.special_instructions || "",
      internal_notes: b.internal_notes || "",
      assigned_driver: b.assigned_driver || "",
      vehicle_reg: b.vehicle_reg || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      customer_id: form.customer_id || null,
      site_id: form.site_id || null,
      collection_date: form.collection_date || null,
      collection_time_slot: form.collection_time_slot || null,
      container_type: form.container_type || null,
      waste_type: form.waste_type || null,
      quantity: form.quantity,
      status: form.status,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      special_instructions: form.special_instructions || null,
      internal_notes: form.internal_notes || null,
      assigned_driver: form.assigned_driver || null,
      vehicle_reg: form.vehicle_reg || null,
    };

    const statusTyped = form.status as "pending" | "confirmed" | "scheduled" | "in_progress" | "completed" | "cancelled";
    const typedPayload = { ...payload, status: statusTyped };

    if (editingBooking) {
      const { error } = await supabase.from("bookings").update(typedPayload).eq("id", editingBooking.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Booking updated" });
    } else {
      const { error } = await supabase.from("bookings").insert({
        ...typedPayload,
        source: "admin",
      } as any);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Booking created" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this booking?")) return;
    await supabase.from("bookings").delete().eq("id", id);
    toast({ title: "Booking deleted" });
    fetchData();
  };

  const getCustomerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.customer_name || "—";
  const getSiteName = (id: string | null) =>
    sites.find((s) => s.id === id)?.site_name || "—";

  const filtered = bookings.filter((b) => {
    const matchSearch =
      !searchQuery ||
      b.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      getCustomerName(b.customer_id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = bookings.filter((b) => b.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUSES.map((s) => (
          <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{counts[s]}</p>
              <p className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Booking
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Collection Date</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>Latest Skiptrak #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No bookings found</TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-medium">{b.booking_reference}</TableCell>
                  <TableCell>{getCustomerName(b.customer_id)}</TableCell>
                  <TableCell>{getSiteName(b.site_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{b.site_id && latestSkiptrak[b.site_id] ? latestSkiptrak[b.site_id] : "—"}</TableCell>
                  <TableCell>
                    {b.collection_date ? format(new Date(b.collection_date + "T00:00:00"), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>{b.container_type || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>
                      {b.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{b.source || "admin"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setViewBooking(b)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBooking ? `Edit ${editingBooking.booking_reference}` : "New Booking"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v, site_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.customer_name} ({c.customer_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {filteredSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Collection Date</Label>
              <Input type="date" value={form.collection_date} onChange={(e) => setForm({ ...form, collection_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Select value={form.collection_time_slot} onValueChange={(v) => setForm({ ...form, collection_time_slot: v })}>
                <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Container Type</Label>
              <Select value={form.container_type} onValueChange={(v) => setForm({ ...form, container_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select container" /></SelectTrigger>
                <SelectContent>
                  {CONTAINER_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Waste Type</Label>
              <Input value={form.waste_type} onChange={(e) => setForm({ ...form, waste_type: e.target.value })} placeholder="e.g. General Waste, Mixed Recycling" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Assigned Driver</Label>
              <Input value={form.assigned_driver} onChange={(e) => setForm({ ...form, assigned_driver: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Reg</Label>
              <Input value={form.vehicle_reg} onChange={(e) => setForm({ ...form, vehicle_reg: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Special Instructions</Label>
              <Textarea value={form.special_instructions} onChange={(e) => setForm({ ...form, special_instructions: e.target.value })} rows={2} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Internal Notes</Label>
              <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingBooking ? "Update" : "Create"} Booking</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="max-w-lg">
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
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{getCustomerName(viewBooking.customer_id)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Site</span><span>{getSiteName(viewBooking.site_id)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Collection Date</span><span>{viewBooking.collection_date ? format(new Date(viewBooking.collection_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time Slot</span><span>{viewBooking.collection_time_slot || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Container</span><span>{viewBooking.container_type || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Waste Type</span><span>{viewBooking.waste_type || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Latest Skiptrak #</span><span className="font-mono">{viewBooking.site_id && latestSkiptrak[viewBooking.site_id] ? latestSkiptrak[viewBooking.site_id] : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Qty</span><span>{viewBooking.quantity || 1}</span></div>
              {viewBooking.contact_name && <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{viewBooking.contact_name}</span></div>}
              {viewBooking.contact_email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{viewBooking.contact_email}</span></div>}
              {viewBooking.contact_phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{viewBooking.contact_phone}</span></div>}
              {viewBooking.assigned_driver && <div className="flex justify-between"><span className="text-muted-foreground">Driver</span><span>{viewBooking.assigned_driver}</span></div>}
              {viewBooking.vehicle_reg && <div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span>{viewBooking.vehicle_reg}</span></div>}
              {viewBooking.special_instructions && (
                <div>
                  <span className="text-muted-foreground">Special Instructions</span>
                  <p className="mt-1 p-2 bg-muted rounded text-sm">{viewBooking.special_instructions}</p>
                </div>
              )}
              {viewBooking.internal_notes && (
                <div>
                  <span className="text-muted-foreground">Internal Notes</span>
                  <p className="mt-1 p-2 bg-muted rounded text-sm">{viewBooking.internal_notes}</p>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>Created {format(new Date(viewBooking.created_at), "dd/MM/yyyy HH:mm")}</span>
                <span className="capitalize">Source: {viewBooking.source || "admin"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
