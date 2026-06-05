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
import { Plus, Pencil, Trash2, Eye, EyeOff, HardHat } from "lucide-react";
import { AppUserPicker, usernameFromEmail, type AppUserProfile } from "@/components/apps/AppUserPicker";

interface YardStaff {
  id: string;
  staff_name: string;
  username: string | null;
  department: string | null;
  display_order: number;
  is_active: boolean;
  pin: string | null;
  user_id: string | null;
}

export const YardStaffSettings = () => {
  const queryClient = useQueryClient();
  const [editStaff, setEditStaff] = useState<YardStaff | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ staff_name: "", username: "", department: "", pin: "", user_id: "" });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["yard-staff-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("yard_staff")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as YardStaff[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["yard-staff-settings"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("yard_staff").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("yard_staff").insert([data as any]);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.id ? "Staff updated" : "Staff added");
      setEditStaff(null);
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("yard_staff").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("yard_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Staff removed");
    },
  });

  const openAdd = () => {
    setForm({ staff_name: "", username: "", department: "", pin: "" });
    setAddOpen(true);
  };

  const openEdit = (s: YardStaff) => {
    setForm({
      staff_name: s.staff_name,
      username: s.username || "",
      department: s.department || "",
      pin: s.pin || "",
    });
    setEditStaff(s);
  };

  const handleSave = () => {
    const data: Record<string, any> = {
      staff_name: form.staff_name.trim(),
      username: form.username.trim() || null,
      department: form.department.trim() || null,
      pin: form.pin.trim() || null,
    };
    if (!editStaff) {
      data.display_order = staff.length;
    }
    saveMutation.mutate({ id: editStaff?.id, data });
  };

  const activeCount = staff.filter((s) => s.is_active).length;

  const StaffForm = () => (
    <div className="grid gap-3">
      <div>
        <Label className="text-xs">Staff Name *</Label>
        <Input value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })} placeholder="e.g. Jane Doe" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Username (for app login)</Label>
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} placeholder="e.g. jane.doe" autoCapitalize="none" autoCorrect="off" />
        </div>
        <div>
          <Label className="text-xs">Department</Label>
          <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Weighbridge" />
        </div>
      </div>
      <div>
        <Label className="text-xs">PIN (for app login)</Label>
        <Input type="text" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="e.g. 1234" />
      </div>
      <Button onClick={handleSave} disabled={!form.staff_name.trim() || saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? "Saving..." : editStaff ? "Update Staff" : "Add Staff"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <HardHat className="h-3 w-3" />
            {activeCount} active
          </Badge>
          <Badge variant="outline">{staff.length} total</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Staff
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading yard staff...</div>
          ) : (
            <div className="overflow-y-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-20 text-center">PIN</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{s.staff_name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.username || "—"}</TableCell>
                      <TableCell className="text-xs">{s.department || "—"}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{s.pin ? "••••" : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={s.is_active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" : "bg-muted text-muted-foreground"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title={s.is_active ? "Deactivate" : "Activate"}
                            onClick={() => toggleActive.mutate({ id: s.id, is_active: !s.is_active })}
                          >
                            {s.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {staff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No yard staff configured</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Yard Staff</DialogTitle>
          </DialogHeader>
          <StaffForm />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStaff} onOpenChange={(open) => { if (!open) setEditStaff(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Yard Staff</DialogTitle>
          </DialogHeader>
          <StaffForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};
