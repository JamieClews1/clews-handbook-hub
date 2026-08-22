import { useEffect, useState } from "react";
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
import { AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { addDays, fmt } from "@/lib/fire-safety";

interface Drill {
  id: string;
  drill_date: string;
  drill_time: string | null;
  scenario: string | null;
  evacuation_seconds: number | null;
  expected_headcount: number | null;
  actual_headcount: number | null;
  conducted_by: string | null;
  issues: string | null;
  actions: string | null;
}

const DRILL_INTERVAL_DAYS = 182; // six-monthly

const mmss = (secs: number | null) => {
  if (!secs && secs !== 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

const empty = {
  drill_date: new Date().toISOString().slice(0, 10),
  drill_time: "",
  scenario: "",
  evacuation_minutes: "",
  evacuation_seconds: "",
  expected_headcount: "",
  actual_headcount: "",
  conducted_by: "",
  issues: "",
  actions: "",
};

const FireDrillsPanel = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [drills, setDrills] = useState<Drill[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    const { data } = await supabase.from("fire_drills").select("*").order("drill_date", { ascending: false });
    setDrills((data as Drill[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const last = drills[0];
  const nextDue = last ? addDays(last.drill_date, DRILL_INTERVAL_DAYS) : null;
  const overdue = !nextDue || nextDue.getTime() < Date.now();

  const save = async () => {
    const secs =
      (Number(form.evacuation_minutes) || 0) * 60 + (Number(form.evacuation_seconds) || 0) || null;
    const { error } = await supabase.from("fire_drills").insert({
      drill_date: form.drill_date,
      drill_time: form.drill_time || null,
      scenario: form.scenario || null,
      evacuation_seconds: secs,
      expected_headcount: form.expected_headcount ? Number(form.expected_headcount) : null,
      actual_headcount: form.actual_headcount ? Number(form.actual_headcount) : null,
      conducted_by: form.conducted_by || null,
      issues: form.issues || null,
      actions: form.actions || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ ...empty });
    toast({ title: "Drill recorded" });
    load();
  };

  return (
    <div className="space-y-4">
      <Card className={overdue ? "border-destructive/50 bg-destructive/5" : "border-primary/40 bg-primary/5"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            {overdue ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="text-sm font-medium">
                {overdue ? "Fire drill is due" : `Next drill due ${nextDue!.toLocaleDateString("en-GB")}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {last
                  ? `Last drill ${fmt(last.drill_date)} · evacuated in ${mmss(last.evacuation_seconds)}`
                  : "No drill has been recorded yet. Drills should be run at least every six months."}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Record drill
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Fire drill log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Record every drill: evacuation time, roll-call at the assembly point, what went wrong and what was
            done about it.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead>Evacuation</TableHead>
                <TableHead>Roll call</TableHead>
                <TableHead>Conducted by</TableHead>
                <TableHead>Issues / actions</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {drills.map((d) => {
                const shortfall =
                  d.expected_headcount != null &&
                  d.actual_headcount != null &&
                  d.actual_headcount < d.expected_headcount;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      {fmt(d.drill_date)}
                      {d.drill_time && <span className="block text-xs text-muted-foreground">{d.drill_time}</span>}
                    </TableCell>
                    <TableCell className="text-sm">{d.scenario || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{mmss(d.evacuation_seconds)}</Badge>
                    </TableCell>
                    <TableCell className={shortfall ? "font-semibold text-destructive" : ""}>
                      {d.actual_headcount ?? "—"} / {d.expected_headcount ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{d.conducted_by || "—"}</TableCell>
                    <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                      {d.issues && <p>{d.issues}</p>}
                      {d.actions && <p className="text-foreground">Action: {d.actions}</p>}
                      {!d.issues && !d.actions && "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await supabase.from("fire_drills").delete().eq("id", d.id);
                            load();
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {drills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No drills recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record fire drill</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.drill_date}
                onChange={(e) => setForm({ ...form, drill_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input
                placeholder="e.g. 10:15"
                value={form.drill_time}
                onChange={(e) => setForm({ ...form, drill_time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Scenario</Label>
              <Input
                placeholder="e.g. Fire in baler building, unannounced"
                value={form.scenario}
                onChange={(e) => setForm({ ...form, scenario: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Evacuation time (minutes)</Label>
              <Input
                type="number"
                value={form.evacuation_minutes}
                onChange={(e) => setForm({ ...form, evacuation_minutes: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>…and seconds</Label>
              <Input
                type="number"
                value={form.evacuation_seconds}
                onChange={(e) => setForm({ ...form, evacuation_seconds: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected headcount</Label>
              <Input
                type="number"
                value={form.expected_headcount}
                onChange={(e) => setForm({ ...form, expected_headcount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Accounted for at assembly point</Label>
              <Input
                type="number"
                value={form.actual_headcount}
                onChange={(e) => setForm({ ...form, actual_headcount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Conducted by</Label>
              <Input
                value={form.conducted_by}
                onChange={(e) => setForm({ ...form, conducted_by: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Issues found</Label>
              <Textarea rows={3} value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Actions taken</Label>
              <Textarea rows={3} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save drill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FireDrillsPanel;
