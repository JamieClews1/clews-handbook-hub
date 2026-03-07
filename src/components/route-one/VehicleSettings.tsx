import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Truck } from "lucide-react";

interface Vehicle {
  id: string;
  registration: string;
  vehicle_type: string;
  make_model: string | null;
  tare_weight_kg: number | null;
  is_active: boolean;
}

const VEHICLE_TYPES = ["Skip Loader", "Ro Ro", "Grab", "Tipper", "Flatbed", "Artic", "Van", "Other"];

export const VehicleSettings = () => {
  const queryClient = useQueryClient();
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    registration: "",
    vehicle_type: "Skip Loader",
    make_model: "",
    tare_weight_kg: "",
  });

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["route-one-vehicles-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_vehicles")
        .select("*")
        .order("registration");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["route-one-vehicles-settings"] });
    queryClient.invalidateQueries({ queryKey: ["route-one-vehicles-all"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("route_one_vehicles").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("route_one_vehicles").insert([data as any]);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      invalidateAll();
      toast.success(vars.id ? "Vehicle updated" : "Vehicle added");
      setEditVehicle(null);
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("route_one_vehicles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("route_one_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Vehicle removed");
    },
  });

  const openAdd = () => {
    setForm({ registration: "", vehicle_type: "Skip Loader", make_model: "", tare_weight_kg: "" });
    setAddOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setForm({
      registration: v.registration,
      vehicle_type: v.vehicle_type,
      make_model: v.make_model || "",
      tare_weight_kg: v.tare_weight_kg?.toString() || "",
    });
    setEditVehicle(v);
  };

  const handleSave = () => {
    const data: Record<string, any> = {
      registration: form.registration.trim().toUpperCase(),
      vehicle_type: form.vehicle_type,
      make_model: form.make_model.trim() || null,
      tare_weight_kg: form.tare_weight_kg ? parseFloat(form.tare_weight_kg) : null,
    };
    saveMutation.mutate({ id: editVehicle?.id, data });
  };

  const activeCount = vehicles.filter(v => v.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Truck className="h-3 w-3" />
            {activeCount} active
          </Badge>
          <Badge variant="outline">{vehicles.length} total</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Vehicle
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading vehicles...</div>
          ) : (
            <div className="overflow-y-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Tare (kg)</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id} className={!v.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-mono font-bold">{v.registration}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{v.vehicle_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{v.make_model || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{v.tare_weight_kg ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={v.is_active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" : "bg-muted text-muted-foreground"}>
                          {v.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive.mutate({ id: v.id, is_active: !v.is_active })}>
                            {v.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(v.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vehicles configured</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen || !!editVehicle} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditVehicle(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Registration *</Label>
                <Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="e.g. AB12 CDE" className="uppercase" />
              </div>
              <div>
                <Label className="text-xs">Vehicle Type</Label>
                <select
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Make / Model</Label>
                <Input value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} placeholder="e.g. DAF LF 7.5t" />
              </div>
              <div>
                <Label className="text-xs">Tare Weight (kg)</Label>
                <Input type="number" value={form.tare_weight_kg} onChange={(e) => setForm({ ...form, tare_weight_kg: e.target.value })} placeholder="e.g. 4500" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={!form.registration.trim() || saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Saving..." : editVehicle ? "Update Vehicle" : "Add Vehicle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
