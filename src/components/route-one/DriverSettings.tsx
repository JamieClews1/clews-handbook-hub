import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Truck, User, Phone, Hash } from "lucide-react";
import { AppUserPicker, usernameFromEmail, type AppUserProfile } from "@/components/apps/AppUserPicker";

interface Driver {
  id: string;
  driver_name: string;
  driver_number: number | null;
  username: string | null;
  mobile: string | null;
  department: number | null;
  category: string | null;
  display_order: number;
  is_active: boolean;
  vehicle_id: string | null;
  pin: string | null;
  route_one_vehicles: { id: string; registration: string; vehicle_type: string } | null;
}

interface Vehicle {
  id: string;
  registration: string;
  vehicle_type: string;
  is_active: boolean;
}

const CATEGORIES = ["Skips", "Ro Ro", "Other"];

export const DriverSettings = () => {
  const queryClient = useQueryClient();
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    driver_name: "",
    driver_number: "",
    username: "",
    mobile: "",
    department: "",
    category: "Skips",
    vehicle_id: "",
    pin: "",
  });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["route-one-drivers-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_drivers")
        .select("*, route_one_vehicles(id, registration, vehicle_type)")
        .order("display_order");
      if (error) throw error;
      return data as Driver[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["route-one-vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_vehicles")
        .select("*")
        .eq("is_active", true)
        .order("registration");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["route-one-drivers-settings"] });
    queryClient.invalidateQueries({ queryKey: ["route-one-drivers"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("route_one_drivers").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("route_one_drivers").insert([data as any]);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      invalidateAll();
      toast.success(vars.id ? "Driver updated" : "Driver added");
      setEditDriver(null);
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("route_one_drivers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("route_one_drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Driver removed");
    },
  });

  const openAdd = () => {
    setForm({ driver_name: "", driver_number: "", username: "", mobile: "", department: "", category: "Skips", vehicle_id: "", pin: "" });
    setAddOpen(true);
  };

  const openEdit = (d: Driver) => {
    setForm({
      driver_name: d.driver_name,
      driver_number: d.driver_number?.toString() || "",
      username: d.username || "",
      mobile: d.mobile || "",
      department: d.department?.toString() || "",
      category: d.category || "Skips",
      vehicle_id: d.vehicle_id || "",
      pin: d.pin || "",
    });
    setEditDriver(d);
  };

  const handleSave = () => {
    const data: Record<string, any> = {
      driver_name: form.driver_name.trim(),
      driver_number: form.driver_number ? parseInt(form.driver_number) : null,
      username: form.username.trim() || null,
      mobile: form.mobile.trim() || null,
      department: form.department ? parseInt(form.department) : null,
      category: form.category || "Skips",
      vehicle_id: form.vehicle_id || null,
      pin: form.pin.trim() || null,
    };
    if (!editDriver) {
      data.display_order = drivers.length;
    }
    saveMutation.mutate({ id: editDriver?.id, data });
  };


  const activeCount = drivers.filter(d => d.is_active).length;

  const DriverForm = () => (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Driver Name *</Label>
          <Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="e.g. John Smith" />
        </div>
        <div>
          <Label className="text-xs">Driver Number</Label>
          <Input type="number" value={form.driver_number} onChange={(e) => setForm({ ...form, driver_number: e.target.value })} placeholder="e.g. 14" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Mobile</Label>
          <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="e.g. 07975995455" />
        </div>
        <div>
          <Label className="text-xs">Department</Label>
          <Input type="number" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. 30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Assigned Vehicle</Label>
          <Select value={form.vehicle_id || "none"} onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.registration} ({v.vehicle_type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Username (for mobile app login)</Label>
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} placeholder="e.g. john.smith" autoCapitalize="none" autoCorrect="off" />
        </div>
        <div>
          <Label className="text-xs">Driver PIN (for mobile app)</Label>
          <Input type="text" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="e.g. 1234" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={!form.driver_name.trim() || saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? "Saving..." : editDriver ? "Update Driver" : "Add Driver"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" />
              {activeCount} active
            </Badge>
            <Badge variant="outline">{drivers.length} total</Badge>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Driver
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading drivers...</div>
          ) : (
            <div className="overflow-y-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="w-16">Dept</TableHead>
                    <TableHead className="w-20">Category</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.id} className={!d.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{d.driver_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{d.driver_name}</TableCell>
                      <TableCell>
                        {d.route_one_vehicles ? (
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs">{d.route_one_vehicles.registration}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{d.route_one_vehicles.vehicle_type}</Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.mobile ? (
                          <span className="text-xs font-mono">{d.mobile}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{d.department ?? "—"}</TableCell>
                      <TableCell>
                        {d.category && (
                          <Badge variant="outline" className={`text-[10px] h-5 ${
                            d.category === "Skips" ? "bg-primary/10 text-primary border-primary/30" :
                            d.category === "Ro Ro" ? "bg-blue-500/10 text-blue-700 border-blue-500/30" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {d.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={d.is_active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" : "bg-muted text-muted-foreground"}>
                          {d.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title={d.is_active ? "Deactivate" : "Activate"}
                            onClick={() => toggleActive.mutate({ id: d.id, is_active: !d.is_active })}
                          >
                            {d.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No drivers configured</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
          </DialogHeader>
          <DriverForm />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDriver} onOpenChange={(open) => { if (!open) setEditDriver(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          <DriverForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};
