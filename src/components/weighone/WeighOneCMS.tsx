import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Search, Truck, Building2, Eye, EyeOff } from "lucide-react";

interface WeighbridgeCustomer {
  id: string;
  customer_name: string;
  is_active: boolean;
  created_at: string;
}

interface WeighbridgeVehicle {
  id: string;
  vehicle_reg: string;
  is_active: boolean;
  created_at: string;
}

export const WeighOneCMS = () => {
  const queryClient = useQueryClient();
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newVehicle, setNewVehicle] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch all customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["weighbridge-customers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_customers")
        .select("*")
        .order("customer_name", { ascending: true });
      if (error) throw error;
      return data as WeighbridgeCustomer[];
    },
  });

  // Fetch all vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["weighbridge-vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_vehicles")
        .select("*")
        .order("vehicle_reg", { ascending: true });
      if (error) throw error;
      return data as WeighbridgeVehicle[];
    },
  });

  // Sync from Midweigh
  const syncFromMidweigh = async () => {
    setIsSyncing(true);
    try {
      // Fetch distinct customers from data hub
      const { data: hubCustomers, error: custErr } = await supabase
        .from("data_hub_jobs")
        .select("customer")
        .eq("source", "midweigh")
        .not("customer", "is", null)
        .not("customer", "eq", "");

      if (custErr) throw custErr;

      const uniqueCustomers = [...new Set(
        (hubCustomers || []).map(r => r.customer).filter(Boolean) as string[]
      )];

      // Fetch distinct vehicles from data hub
      const { data: hubVehicles, error: vehErr } = await supabase
        .from("data_hub_jobs")
        .select("vehicle_registration")
        .eq("source", "midweigh")
        .not("vehicle_registration", "is", null)
        .not("vehicle_registration", "eq", "");

      if (vehErr) throw vehErr;

      const uniqueVehicles = [...new Set(
        (hubVehicles || []).map(r => r.vehicle_registration?.toUpperCase().trim()).filter(Boolean) as string[]
      )];

      // Get existing records to find new ones
      const existingCustomerNames = new Set(customers.map(c => c.customer_name));
      const existingVehicleRegs = new Set(vehicles.map(v => v.vehicle_reg));

      const newCustomers = uniqueCustomers.filter(c => !existingCustomerNames.has(c));
      const newVehicles = uniqueVehicles.filter(v => !existingVehicleRegs.has(v));

      let insertedCustomers = 0;
      let insertedVehicles = 0;

      // Insert new customers in batches
      if (newCustomers.length > 0) {
        const { error } = await supabase
          .from("weighbridge_customers")
          .upsert(
            newCustomers.map(name => ({ customer_name: name })),
            { onConflict: "customer_name" }
          );
        if (error) throw error;
        insertedCustomers = newCustomers.length;
      }

      // Insert new vehicles in batches
      if (newVehicles.length > 0) {
        const { error } = await supabase
          .from("weighbridge_vehicles")
          .upsert(
            newVehicles.map(reg => ({ vehicle_reg: reg })),
            { onConflict: "vehicle_reg" }
          );
        if (error) throw error;
        insertedVehicles = newVehicles.length;
      }

      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles"] });

      if (insertedCustomers === 0 && insertedVehicles === 0) {
        toast.info("Already up to date — no new records found in Midweigh data");
      } else {
        toast.success(`Synced ${insertedCustomers} new customers and ${insertedVehicles} new vehicles from Midweigh`);
      }
    } catch (err: any) {
      toast.error("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle active status
  const toggleCustomerActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("weighbridge_customers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers"] });
    },
  });

  const toggleVehicleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("weighbridge_vehicles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles"] });
    },
  });

  // Add manual entries
  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weighbridge_customers").insert({ customer_name: newCustomer.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer added");
      setNewCustomer("");
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const addVehicleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weighbridge_vehicles").insert({ vehicle_reg: newVehicle.trim().toUpperCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle added");
      setNewVehicle("");
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighbridge_customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers"] });
      toast.success("Customer removed");
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighbridge_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles-all"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-vehicles"] });
      toast.success("Vehicle removed");
    },
  });

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.customer_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredVehicles = vehicles.filter(v =>
    !vehicleSearch || v.vehicle_reg.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const activeCustomers = customers.filter(c => c.is_active).length;
  const activeVehicles = vehicles.filter(v => v.is_active).length;

  return (
    <div className="space-y-4">
      {/* Sync Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Vehicles and customers are automatically recognised from Midweigh data. Use sync to pull new entries.
          </p>
        </div>
        <Button onClick={syncFromMidweigh} disabled={isSyncing} className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync from Midweigh"}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{activeCustomers}</p>
                <p className="text-xs text-muted-foreground">Active Customers ({customers.length} total)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{activeVehicles}</p>
                <p className="text-xs text-muted-foreground">Active Vehicles ({vehicles.length} total)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers" className="gap-2"><Building2 className="h-4 w-4" /> Customers</TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-2"><Truck className="h-4 w-4" /> Vehicles</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-9" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="New customer name" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} className="w-48" />
              <Button size="sm" className="gap-1 h-10" disabled={!newCustomer.trim() || addCustomerMutation.isPending} onClick={() => addCustomerMutation.mutate()}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              {customersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-y-auto max-h-[50vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((c) => (
                        <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{c.customer_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={c.is_active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" : "bg-muted text-muted-foreground"}>
                              {c.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title={c.is_active ? "Deactivate" : "Activate"}
                                onClick={() => toggleCustomerActive.mutate({ id: c.id, is_active: !c.is_active })}
                              >
                                {c.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteCustomerMutation.mutate(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vehicles..." className="pl-9" value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="New vehicle reg" value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} className="w-48" />
              <Button size="sm" className="gap-1 h-10" disabled={!newVehicle.trim() || addVehicleMutation.isPending} onClick={() => addVehicleMutation.mutate()}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              {vehiclesLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-y-auto max-h-[50vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle Reg</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVehicles.map((v) => (
                        <TableRow key={v.id} className={!v.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-mono font-medium">{v.vehicle_reg}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={v.is_active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" : "bg-muted text-muted-foreground"}>
                              {v.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title={v.is_active ? "Deactivate" : "Activate"}
                                onClick={() => toggleVehicleActive.mutate({ id: v.id, is_active: !v.is_active })}
                              >
                                {v.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteVehicleMutation.mutate(v.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
