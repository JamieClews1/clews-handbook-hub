import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { addDays, fmt } from "@/lib/fire-safety";

interface Check {
  id: string;
  item_type: string;
  item_ref: string | null;
  location: string | null;
  frequency_days: number;
  last_checked_on: string | null;
  checked_by: string | null;
  status: string;
  defects: string | null;
  is_active: boolean;
}

const dueInfo = (c: Check) => {
  if (!c.last_checked_on) return { label: "Never checked", days: -999, tone: "destructive" as const };
  const due = addDays(c.last_checked_on, c.frequency_days);
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  return {
    label: days < 0 ? `Overdue by ${Math.abs(days)}d` : `Due in ${days}d`,
    days,
    tone: days < 0 ? ("destructive" as const) : days <= 7 ? ("outline" as const) : ("secondary" as const),
  };
};

const FireEquipmentChecksPanel = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<Check[]>([]);
  const [completing, setCompleting] = useState<Check | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [complete, setComplete] = useState({ date: "", by: "", status: "ok", defects: "" });
  const [newItem, setNewItem] = useState({ item_type: "", item_ref: "", location: "", frequency_days: "30" });

  const load = async () => {
    const { data } = await supabase.from("fire_equipment_checks").select("*").eq("is_active", true).order("item_type");
    setChecks((data as Check[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(
    () => [...checks].sort((a, b) => dueInfo(a).days - dueInfo(b).days),
    [checks]
  );
  const overdue = sorted.filter((c) => dueInfo(c).days < 0).length;

  const openComplete = (c: Check) => {
    setCompleting(c);
    setComplete({ date: new Date().toISOString().slice(0, 10), by: "", status: "ok", defects: "" });
  };

  const saveComplete = async () => {
    if (!completing) return;
    const { error } = await supabase
      .from("fire_equipment_checks")
      .update({
        last_checked_on: complete.date,
        checked_by: complete.by || null,
        status: complete.defects ? "defect" : "ok",
        defects: complete.defects || null,
      })
      .eq("id", completing.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setCompleting(null);
    load();
  };

  const addItem = async () => {
    if (!newItem.item_type.trim()) return;
    const { error } = await supabase.from("fire_equipment_checks").insert({
      item_type: newItem.item_type.trim(),
      item_ref: newItem.item_ref || null,
      location: newItem.location || null,
      frequency_days: Number(newItem.frequency_days) || 30,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setAddOpen(false);
    setNewItem({ item_type: "", item_ref: "", location: "", frequency_days: "30" });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-lg">Equipment and periodic checks</CardTitle>
          <p className="text-sm text-muted-foreground">
            Extinguishers, emergency lighting, fire doors, signage and escape routes — each with its own
            frequency and next-due date. {overdue > 0 && <span className="font-medium text-destructive">{overdue} overdue.</span>}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add check
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Last done</TableHead>
              <TableHead>Next due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => {
              const info = dueInfo(c);
              return (
                <TableRow key={c.id} className={info.days < 0 ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <p className="font-medium">{c.item_type}</p>
                    {c.item_ref && <p className="text-xs text-muted-foreground">{c.item_ref}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.location || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {c.frequency_days >= 365
                      ? "Annual"
                      : c.frequency_days >= 90
                        ? "Quarterly"
                        : c.frequency_days >= 28
                          ? "Monthly"
                          : `Every ${c.frequency_days} days`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmt(c.last_checked_on)}
                    {c.checked_by && <span className="block text-xs text-muted-foreground">{c.checked_by}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={info.tone}>{info.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm">
                    {c.defects ? (
                      <span className="text-destructive">{c.defects}</span>
                    ) : (
                      <span className="text-muted-foreground">OK</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openComplete(c)}>
                        Record check
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await supabase.from("fire_equipment_checks").delete().eq("id", c.id);
                            load();
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record check — {completing?.item_type}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date checked</Label>
                <Input
                  type="date"
                  value={complete.date}
                  onChange={(e) => setComplete({ ...complete, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Checked by</Label>
                <Input value={complete.by} onChange={(e) => setComplete({ ...complete, by: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Defects found (leave blank if all OK)</Label>
              <Textarea
                rows={3}
                value={complete.defects}
                onChange={(e) => setComplete({ ...complete, defects: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button onClick={saveComplete}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a recurring check</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Check name</Label>
              <Input
                value={newItem.item_type}
                onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={newItem.item_ref} onChange={(e) => setNewItem({ ...newItem, item_ref: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={newItem.location} onChange={(e) => setNewItem({ ...newItem, location: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency (days)</Label>
              <Input
                type="number"
                value={newItem.frequency_days}
                onChange={(e) => setNewItem({ ...newItem, frequency_days: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addItem}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FireEquipmentChecksPanel;
