import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";
import type { FuelSurchargeRate, SurchargeZone, VehicleCategory } from "@/lib/fuel-surcharge";
import { formatGBP } from "@/lib/fuel-surcharge";

const VEHICLES: VehicleCategory[] = ["Weighbridge Tip", "Skips", "RoRo", "Artic"];
const ZONES: SurchargeZone[] = ["NA", "Zone 1", "Zone 2", "Zone 3"];

interface Props {
  canEdit: boolean;
}

export default function FuelSurchargeRatesEditor({ canEdit }: Props) {
  const { toast } = useToast();
  const [rates, setRates] = useState<FuelSurchargeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FuelSurchargeRate | null>(null);

  const [form, setForm] = useState({
    effective_from_date: new Date().toISOString().slice(0, 10),
    vehicle_category: "Skips" as VehicleCategory,
    zone: "Zone 1" as SurchargeZone,
    surcharge_amount: "0.00",
    active: true,
    notes: "",
    customer_match: "",
  });

  async function fetchRates() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fuel_surcharge_rates")
      .select("*")
      .order("customer_match", { ascending: true, nullsFirst: true })
      .order("effective_from_date", { ascending: false })
      .order("vehicle_category")
      .order("zone");
    if (error) toast({ title: "Failed to load rates", description: error.message, variant: "destructive" });
    else setRates((data ?? []) as FuelSurchargeRate[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchRates();
  }, []);

  function openNew() {
    setEditing(null);
    setForm({
      effective_from_date: new Date().toISOString().slice(0, 10),
      vehicle_category: "Skips",
      zone: "Zone 1",
      surcharge_amount: "0.00",
      active: true,
      notes: "",
      customer_match: "",
    });
    setOpen(true);
  }

  function openEdit(r: FuelSurchargeRate) {
    setEditing(r);
    setForm({
      effective_from_date: r.effective_from_date,
      vehicle_category: r.vehicle_category,
      zone: r.zone,
      surcharge_amount: r.surcharge_amount.toString(),
      active: r.active,
      notes: r.notes ?? "",
      customer_match: r.customer_match ?? "",
    });
    setOpen(true);
  }

  async function save() {
    const customerMatch = form.customer_match.trim();
    const payload = {
      effective_from_date: form.effective_from_date,
      vehicle_category: form.vehicle_category,
      // Customer-specific rates are flat fees that ignore zone (stored as 'NA')
      zone: customerMatch || form.vehicle_category === "Weighbridge Tip" ? "NA" : form.zone,
      surcharge_amount: Number(form.surcharge_amount),
      active: form.active,
      notes: form.notes || null,
      customer_match: customerMatch || null,
    };
    if (Number.isNaN(payload.surcharge_amount)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    let error;
    if (editing) {
      ({ error } = await supabase.from("fuel_surcharge_rates").update(payload).eq("id", editing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase.from("fuel_surcharge_rates").insert({ ...payload, created_by: u.user?.id }));
    }
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Rate updated" : "Rate created" });
    setOpen(false);
    fetchRates();
  }

  async function toggleActive(r: FuelSurchargeRate) {
    const { error } = await supabase
      .from("fuel_surcharge_rates")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else fetchRates();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fuel Surcharge Rates</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Historical rates are preserved. Edits create updates only — never overwrite past records by reusing the same effective date for unrelated changes; create a new row instead.
          </p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> New Rate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Rate" : "New Surcharge Rate"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Effective From</Label>
                    <Input
                      type="date"
                      value={form.effective_from_date}
                      onChange={(e) => setForm({ ...form, effective_from_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Amount (£ ex VAT)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.surcharge_amount}
                      onChange={(e) => setForm({ ...form, surcharge_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vehicle Category</Label>
                    <Select
                      value={form.vehicle_category}
                      onValueChange={(v) => setForm({ ...form, vehicle_category: v as VehicleCategory })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VEHICLES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <Select
                      value={form.customer_match.trim() || form.vehicle_category === "Weighbridge Tip" ? "NA" : form.zone}
                      disabled={!!form.customer_match.trim() || form.vehicle_category === "Weighbridge Tip"}
                      onValueChange={(v) => setForm({ ...form, zone: v as SurchargeZone })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ZONES.filter((z) => (form.customer_match.trim() || form.vehicle_category === "Weighbridge Tip") ? z === "NA" : z !== "NA").map((z) => (
                          <SelectItem key={z} value={z}>{z}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Customer (optional)</Label>
                  <Input
                    value={form.customer_match}
                    onChange={(e) => setForm({ ...form, customer_match: e.target.value })}
                    placeholder="Leave blank for all customers — e.g. 'Go Green Limited'"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer-specific rates override the standard zone-based rate (case-insensitive contains match) and apply as a flat fee for any zone.
                  </p>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save Changes" : "Create Rate"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle Category</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Active</TableHead>
                  {canEdit && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.effective_from_date}</TableCell>
                    <TableCell className="font-medium">
                      {r.customer_match ? r.customer_match : <span className="text-muted-foreground">All customers</span>}
                    </TableCell>
                    <TableCell>{r.vehicle_category}</TableCell>
                    <TableCell>{r.customer_match ? <span className="text-muted-foreground">Any</span> : r.zone}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(Number(r.surcharge_amount))}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.notes ?? ""}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                      ) : (
                        <span className={r.active ? "text-primary" : "text-muted-foreground"}>{r.active ? "Yes" : "No"}</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {rates.length === 0 && (
                  <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground">No rates configured</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
