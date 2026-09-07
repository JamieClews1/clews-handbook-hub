import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { AppUserPicker, type AppUserProfile } from "@/components/apps/AppUserPicker";
import {
  STAFF_GROUPS,
  fullName,
  groupBadgeClass,
  groupLabel,
  money,
  type PayrollEmployee,
  type StaffGroup,
} from "@/lib/payroll";

const emptyForm = {
  user_id: "",
  employee_no: "",
  payroll_no: "",
  first_name: "",
  surname: "",
  staff_group: "yard" as StaffGroup,
  week_setup: "",
  basic_rate: "",
  higher_rate: "",
  saturday_rate: "",
  holiday_rate: "",
  weekly_bonus: "",
  contracted_hours: "40",
  is_active: true,
};

export default function PayrollStaffTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_employees")
        .select("*")
        .order("surname");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollEmployee[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: form.user_id || null,
        employee_no: form.employee_no ? Number(form.employee_no) : null,
        payroll_no: form.payroll_no.trim() || null,
        first_name: form.first_name.trim(),
        surname: form.surname.trim(),
        staff_group: form.staff_group,
        week_setup: form.week_setup.trim() || null,
        basic_rate: Number(form.basic_rate) || 0,
        higher_rate: Number(form.higher_rate) || 0,
        saturday_rate: Number(form.saturday_rate) || 0,
        holiday_rate: Number(form.holiday_rate) || 0,
        weekly_bonus: Number(form.weekly_bonus) || 0,
        contracted_hours: Number(form.contracted_hours) || 40,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("payroll_employees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_employees").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-employees"] });
      toast.success(editing ? "Staff member updated" : "Staff member added");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-employees"] });
      toast.success("Staff member removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (e: PayrollEmployee) => {
    setEditing(e);
    setForm({
      user_id: e.user_id ?? "",
      employee_no: e.employee_no != null ? String(e.employee_no) : "",
      payroll_no: e.payroll_no ?? "",
      first_name: e.first_name,
      surname: e.surname,
      staff_group: (e.staff_group ?? "yard") as StaffGroup,
      week_setup: e.week_setup ?? "",
      basic_rate: String(e.basic_rate ?? ""),
      higher_rate: String(e.higher_rate ?? ""),
      saturday_rate: String(e.saturday_rate ?? ""),
      holiday_rate: String(e.holiday_rate ?? ""),
      weekly_bonus: String(e.weekly_bonus ?? ""),
      contracted_hours: String(e.contracted_hours ?? 40),
      is_active: e.is_active,
    });
    setOpen(true);
  };

  const handleSelectUser = (profile: AppUserProfile) => {
    const name = (profile.full_name || profile.email.split("@")[0] || "").trim();
    const parts = name.split(/\s+/);
    setForm((prev) => ({
      ...prev,
      user_id: profile.id,
      first_name: prev.first_name || parts[0] || "",
      surname: prev.surname || parts.slice(1).join(" ") || "",
    }));
  };

  const filtered = useMemo(
    () => (groupFilter === "all" ? employees : employees.filter((e) => e.staff_group === groupFilter)),
    [employees, groupFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" /> {employees.filter((e) => e.is_active).length} active
          </Badge>
          {STAFF_GROUPS.map((g) => (
            <Badge key={g.value} variant="outline" className={groupBadgeClass(g.value)}>
              {g.label}: {employees.filter((e) => e.staff_group === g.value).length}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {STAFF_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" /> Add staff
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading staff…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Emp No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Group</TableHead>
                  <TableHead className="w-28 text-right">Basic</TableHead>
                  <TableHead className="w-28 text-right">Higher</TableHead>
                  <TableHead className="w-28 text-right">Saturday</TableHead>
                  <TableHead className="w-28 text-right">Holiday</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className={e.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-mono text-xs">{e.employee_no ?? "—"}</TableCell>
                    <TableCell className="font-medium">{fullName(e)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={groupBadgeClass(e.staff_group)}>
                        {groupLabel(e.staff_group)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{money(e.basic_rate)}</TableCell>
                    <TableCell className="text-right">{money(e.higher_rate)}</TableCell>
                    <TableCell className="text-right">{money(e.saturday_rate)}</TableCell>
                    <TableCell className="text-right">{money(e.holiday_rate)}</TableCell>
                    <TableCell className="text-center text-xs">{e.is_active ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No payroll staff yet — add your first person.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff member" : "Add staff member"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Linked app user</Label>
              <AppUserPicker
                value={form.user_id || null}
                fallbackLabel={`${form.first_name} ${form.surname}`.trim()}
                onSelect={handleSelectUser}
                placeholder="Search existing users…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First name</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Surname</Label>
                <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Employee no</Label>
                <Input
                  inputMode="numeric"
                  value={form.employee_no}
                  onChange={(e) => setForm({ ...form, employee_no: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <div>
                <Label className="text-xs">Payroll no</Label>
                <Input value={form.payroll_no} onChange={(e) => setForm({ ...form, payroll_no: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Group</Label>
                <Select
                  value={form.staff_group}
                  onValueChange={(v) => setForm({ ...form, staff_group: v as StaffGroup })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ["basic_rate", "Basic £/h"],
                  ["higher_rate", "Higher £/h"],
                  ["saturday_rate", "Saturday £/h"],
                  ["holiday_rate", "Holiday £/h"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    inputMode="decimal"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Weekly bonus £</Label>
                <Input
                  inputMode="decimal"
                  value={form.weekly_bonus}
                  onChange={(e) => setForm({ ...form, weekly_bonus: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Contracted hours</Label>
                <Input
                  inputMode="decimal"
                  value={form.contracted_hours}
                  onChange={(e) => setForm({ ...form, contracted_hours: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.first_name.trim() || !form.surname.trim() || save.isPending}
            >
              {save.isPending ? "Saving…" : editing ? "Update staff member" : "Add staff member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
