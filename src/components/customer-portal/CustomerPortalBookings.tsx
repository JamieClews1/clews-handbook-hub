import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";

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

interface Props {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

export const CustomerPortalBookings = ({ customerId, customerName, accessibleSiteIds }: Props) => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sites, setSites] = useState<{ id: string; site_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
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

    // Load accessible sites
    let siteQuery = supabase.from("customer_sites").select("id, site_name").eq("customer_id", customerId);
    if (accessibleSiteIds && accessibleSiteIds.length > 0) {
      siteQuery = siteQuery.in("id", accessibleSiteIds);
    }
    const { data: sitesData } = await siteQuery.order("site_name");
    setSites(sitesData ?? []);

    // Load bookings for those sites
    const siteIds = accessibleSiteIds && accessibleSiteIds.length > 0
      ? accessibleSiteIds
      : (sitesData ?? []).map(s => s.id);

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
  };

  const getSiteName = (id: string | null) =>
    sites.find(s => s.id === id)?.site_name || "—";

  const handleCreate = async () => {
    if (!form.site_id) {
      toast({ title: "Please select a site", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("bookings").insert({
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
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Booking request submitted", description: "We'll confirm your collection shortly." });
    setCreateOpen(false);
    setForm({
      site_id: "", collection_date: "", collection_time_slot: "", container_type: "",
      waste_type: "", quantity: 1, contact_name: "", contact_email: "", contact_phone: "",
      special_instructions: "",
    });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Request Collection
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No bookings yet. Request your first collection above.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Collection Date</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono font-medium">{b.booking_reference}</TableCell>
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
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Collection</DialogTitle>
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
