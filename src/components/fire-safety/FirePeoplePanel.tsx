import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FIRE_ROLES, FirePerson, fireRoleLabel, fmt } from "@/lib/fire-safety";

const empty = {
  full_name: "",
  role: "fire_warden",
  area: "",
  phone: "",
  email: "",
  appointed_on: "",
  training_expiry: "",
};

const FirePeoplePanel = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState<FirePerson[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FirePerson | null>(null);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    const { data } = await supabase.from("fire_safety_people").select("*").order("sort_order");
    setPeople((data as FirePerson[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (p: FirePerson) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      role: p.role,
      area: p.area || "",
      phone: p.phone || "",
      email: p.email || "",
      appointed_on: p.appointed_on || "",
      training_expiry: p.training_expiry || "",
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      full_name: form.full_name.trim(),
      role: form.role,
      area: form.area || null,
      phone: form.phone || null,
      email: form.email || null,
      appointed_on: form.appointed_on || null,
      training_expiry: form.training_expiry || null,
    };
    if (!payload.full_name) return;
    const { error } = editing
      ? await supabase.from("fire_safety_people").update(payload).eq("id", editing.id)
      : await supabase
          .from("fire_safety_people")
          .insert({ ...payload, sort_order: (people.at(-1)?.sort_order ?? 0) + 1 });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    load();
  };

  const remove = async (p: FirePerson) => {
    await supabase.from("fire_safety_people").delete().eq("id", p.id);
    load();
  };

  const expiringSoon = (iso: string | null) => {
    if (!iso) return false;
    const days = (new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / 86400000;
    return days < 60;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-lg">Responsible people register</CardTitle>
          <p className="text-sm text-muted-foreground">
            The single source of truth for the Responsible Person, deputies, fire wardens, marshals and first
            aiders. These names appear automatically in the site induction and fire safety documents.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2 shrink-0" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add person
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Appointed</TableHead>
              <TableHead>Training expiry</TableHead>
              {isAdmin && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id} className={p.is_active ? "" : "opacity-50"}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{fireRoleLabel(p.role)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.area || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.phone || p.email || "—"}
                </TableCell>
                <TableCell className="text-sm">{fmt(p.appointed_on)}</TableCell>
                <TableCell className="text-sm">
                  {p.training_expiry ? (
                    <span className={expiringSoon(p.training_expiry) ? "font-semibold text-destructive" : ""}>
                      {fmt(p.training_expiry)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not recorded</span>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {people.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No one recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit person" : "Add person"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIRE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Area covered</Label>
              <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Appointed on</Label>
              <Input
                type="date"
                value={form.appointed_on}
                onChange={(e) => setForm({ ...form, appointed_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Training expiry</Label>
              <Input
                type="date"
                value={form.training_expiry}
                onChange={(e) => setForm({ ...form, training_expiry: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FirePeoplePanel;
