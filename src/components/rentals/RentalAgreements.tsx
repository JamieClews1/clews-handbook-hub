import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export type RentalAgreement = {
  id: string;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  agreed_rate: number | null;
  rate_period: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  source: string;
  created_at: string;
};

const EMPTY = {
  customer: "",
  site: "",
  container_type: "",
  agreed_rate: "",
  rate_period: "week",
  start_date: "",
  end_date: "",
  status: "active",
  notes: "",
};

export default function RentalAgreements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RentalAgreement | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const fetchAgreements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rental_agreements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setAgreements((data ?? []) as RentalAgreement[]);
    setLoading(false);
  };

  useEffect(() => { fetchAgreements(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  };

  const openEdit = (a: RentalAgreement) => {
    setEditing(a);
    setForm({
      customer: a.customer ?? "",
      site: a.site ?? "",
      container_type: a.container_type ?? "",
      agreed_rate: a.agreed_rate != null ? String(a.agreed_rate) : "",
      rate_period: a.rate_period ?? "week",
      start_date: a.start_date ?? "",
      end_date: a.end_date ?? "",
      status: a.status ?? "active",
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.customer.trim()) {
      toast({ title: "Customer is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      customer: form.customer.trim(),
      site: form.site.trim() || null,
      container_type: form.container_type.trim() || null,
      agreed_rate: form.agreed_rate ? Number(form.agreed_rate) : null,
      rate_period: form.rate_period,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("rental_agreements").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("rental_agreements").insert({ ...payload, source: "manual", created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Agreement updated" : "Agreement added" });
    setOpen(false);
    fetchAgreements();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("rental_agreements").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agreement removed" });
    fetchAgreements();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Confirmed Rental Agreements ({agreements.length})
          </CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Agreement
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Rental agreements currently in place. Agreements created when a customer agrees to pay appear here automatically.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : agreements.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No rental agreements yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Container</TableHead>
                <TableHead className="text-right">Agreed Rate</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.customer}</TableCell>
                  <TableCell>{a.site || "—"}</TableCell>
                  <TableCell>{a.container_type || "—"}</TableCell>
                  <TableCell className="text-right">
                    {a.agreed_rate != null ? `£${a.agreed_rate.toFixed(2)} / ${a.rate_period}` : "—"}
                  </TableCell>
                  <TableCell>{a.start_date ? format(new Date(a.start_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className="capitalize">{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{a.source}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete agreement?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the rental agreement for {a.customer}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(a.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rental Agreement" : "Add Rental Agreement"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Customer *</Label>
              <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Container Type</Label>
              <Input value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Agreed Rate (£)</Label>
              <Input type="number" step="0.01" value={form.agreed_rate} onChange={(e) => setForm({ ...form, agreed_rate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Per</Label>
              <Select value={form.rate_period} onValueChange={(v) => setForm({ ...form, rate_period: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
