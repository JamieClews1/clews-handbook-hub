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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { fmt } from "@/lib/fire-safety";

interface WeeklyTest {
  id: string;
  test_date: string;
  call_point: string | null;
  tested_by: string | null;
  result: string;
  audible_everywhere: boolean;
  defects: string | null;
  notes: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const FireWeeklyTestsPanel = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [tests, setTests] = useState<WeeklyTest[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    test_date: today(),
    call_point: "",
    tested_by: "",
    result: "pass",
    audible_everywhere: true,
    defects: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("fire_weekly_tests")
      .select("*")
      .order("test_date", { ascending: false })
      .limit(60);
    setTests((data as WeeklyTest[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const last = tests[0];
  const daysSince = last
    ? Math.floor((Date.now() - new Date(`${last.test_date}T00:00:00Z`).getTime()) / 86400000)
    : null;
  const overdue = daysSince === null || daysSince > 7;

  const save = async () => {
    const { error } = await supabase.from("fire_weekly_tests").insert({
      test_date: form.test_date,
      call_point: form.call_point || null,
      tested_by: form.tested_by || null,
      result: form.result,
      audible_everywhere: form.audible_everywhere,
      defects: form.defects || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ ...form, call_point: "", defects: "", result: "pass", audible_everywhere: true });
    toast({ title: "Test logged" });
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
                {overdue ? "Weekly alarm test is due" : "Weekly alarm test up to date"}
              </p>
              <p className="text-xs text-muted-foreground">
                {last
                  ? `Last tested ${fmt(last.test_date)} (${daysSince} day${daysSince === 1 ? "" : "s"} ago)${
                      last.call_point ? ` · call point ${last.call_point}` : ""
                    }`
                  : "No test has been logged yet."}
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Log weekly test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly fire alarm test log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test a different call point each week so every point is proven over time. Record the tester, the
            result and any defect raised.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Call point</TableHead>
                <TableHead>Tested by</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Audible site-wide</TableHead>
                <TableHead>Defects</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{fmt(t.test_date)}</TableCell>
                  <TableCell>{t.call_point || "—"}</TableCell>
                  <TableCell>{t.tested_by || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.result === "pass" ? "secondary" : "destructive"}>
                      {t.result === "pass" ? "Pass" : "Fail"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.audible_everywhere ? "Yes" : <span className="text-destructive">No</span>}</TableCell>
                  <TableCell className="max-w-[280px] text-sm text-muted-foreground">{t.defects || "—"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          await supabase.from("fire_weekly_tests").delete().eq("id", t.id);
                          load();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {tests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No tests logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log weekly alarm test</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.test_date}
                onChange={(e) => setForm({ ...form, test_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Call point tested</Label>
              <Input
                placeholder="e.g. CP3 — baler building"
                value={form.call_point}
                onChange={(e) => setForm({ ...form, call_point: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tested by</Label>
              <Input value={form.tested_by} onChange={(e) => setForm({ ...form, tested_by: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={form.audible_everywhere}
                onCheckedChange={(v) => setForm({ ...form, audible_everywhere: !!v })}
              />
              Alarm was audible across the whole site
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Defects / actions</Label>
              <Textarea
                rows={3}
                value={form.defects}
                onChange={(e) => setForm({ ...form, defects: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FireWeeklyTestsPanel;
