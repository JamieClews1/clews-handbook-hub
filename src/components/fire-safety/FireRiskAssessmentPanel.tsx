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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { fmt } from "@/lib/fire-safety";

interface Assessment {
  id: string;
  title: string;
  assessment_date: string;
  assessor: string | null;
  review_due: string | null;
  summary: string | null;
  is_current: boolean;
}

interface Action {
  id: string;
  assessment_id: string | null;
  finding: string;
  action: string | null;
  owner: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed_on: string | null;
}

const PRIORITIES = ["high", "medium", "low"];
const STATUSES = ["open", "in_progress", "complete"];

const FireRiskAssessmentPanel = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [raOpen, setRaOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [raForm, setRaForm] = useState({
    title: "Unit 17 Fire Risk Assessment",
    assessment_date: new Date().toISOString().slice(0, 10),
    assessor: "",
    review_due: "",
    summary: "",
  });
  const [actionForm, setActionForm] = useState({
    finding: "",
    action: "",
    owner: "",
    due_date: "",
    priority: "medium",
  });

  const load = async () => {
    const { data: ra } = await supabase
      .from("fire_risk_assessments")
      .select("*")
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAssessment((ra as Assessment) || null);
    const { data: acts } = await supabase
      .from("fire_risk_actions")
      .select("*")
      .order("due_date", { nullsFirst: false });
    setActions((acts as Action[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const saveRa = async () => {
    const payload = {
      title: raForm.title,
      assessment_date: raForm.assessment_date,
      assessor: raForm.assessor || null,
      review_due: raForm.review_due || null,
      summary: raForm.summary || null,
    };
    const { error } = assessment
      ? await supabase.from("fire_risk_assessments").update(payload).eq("id", assessment.id)
      : await supabase.from("fire_risk_assessments").insert(payload);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRaOpen(false);
    load();
  };

  const saveAction = async () => {
    if (!actionForm.finding.trim()) return;
    const { error } = await supabase.from("fire_risk_actions").insert({
      assessment_id: assessment?.id ?? null,
      finding: actionForm.finding.trim(),
      action: actionForm.action || null,
      owner: actionForm.owner || null,
      due_date: actionForm.due_date || null,
      priority: actionForm.priority,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setActionOpen(false);
    setActionForm({ finding: "", action: "", owner: "", due_date: "", priority: "medium" });
    load();
  };

  const setStatus = async (a: Action, status: string) => {
    await supabase
      .from("fire_risk_actions")
      .update({ status, completed_on: status === "complete" ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", a.id);
    load();
  };

  const openEditRa = () => {
    if (assessment) {
      setRaForm({
        title: assessment.title,
        assessment_date: assessment.assessment_date,
        assessor: assessment.assessor || "",
        review_due: assessment.review_due || "",
        summary: assessment.summary || "",
      });
    }
    setRaOpen(true);
  };

  const reviewOverdue =
    assessment?.review_due && new Date(`${assessment.review_due}T00:00:00Z`).getTime() < Date.now();
  const openActions = actions.filter((a) => a.status !== "complete");
  const overdueActions = openActions.filter(
    (a) => a.due_date && new Date(`${a.due_date}T00:00:00Z`).getTime() < Date.now()
  ).length;

  return (
    <div className="space-y-4">
      <Card className={reviewOverdue ? "border-destructive/50 bg-destructive/5" : ""}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg">Fire risk assessment</CardTitle>
            <p className="text-sm text-muted-foreground">
              The legally required assessment for Unit 17, its review date and significant findings.
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={openEditRa}>
              {assessment ? "Update" : "Add assessment"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!assessment ? (
            <p className="text-sm text-muted-foreground">No fire risk assessment recorded yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
                {[
                  { label: "Assessment", value: assessment.title },
                  { label: "Carried out", value: fmt(assessment.assessment_date) },
                  { label: "Assessor", value: assessment.assessor || "—" },
                  { label: "Review due", value: fmt(assessment.review_due) },
                ].map((m) => (
                  <div key={m.label} className="bg-card px-4 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </p>
                    <p className="text-sm font-medium">{m.value}</p>
                  </div>
                ))}
              </div>
              {reviewOverdue && (
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Review is overdue.
                </p>
              )}
              {assessment.summary && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{assessment.summary}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg">Significant findings and action log</CardTitle>
            <p className="text-sm text-muted-foreground">
              {openActions.length} open{overdueActions > 0 && <span className="text-destructive"> · {overdueActions} overdue</span>}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-2 shrink-0" onClick={() => setActionOpen(true)}>
              <Plus className="h-4 w-4" /> Add finding
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Finding</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => {
                const late =
                  a.status !== "complete" && a.due_date && new Date(`${a.due_date}T00:00:00Z`).getTime() < Date.now();
                return (
                  <TableRow key={a.id} className={late ? "bg-destructive/5" : ""}>
                    <TableCell className="max-w-[260px] font-medium">{a.finding}</TableCell>
                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">{a.action || "—"}</TableCell>
                    <TableCell className="text-sm">{a.owner || "—"}</TableCell>
                    <TableCell className={`text-sm ${late ? "font-semibold text-destructive" : ""}`}>
                      {fmt(a.due_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.priority === "high" ? "destructive" : "secondary"}>{a.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={a.status} onValueChange={(v) => setStatus(a, v)}>
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : a.status === "complete" ? (
                        <Badge className="gap-1">
                          <CheckCircle className="h-3 w-3" /> Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline">{a.status.replace("_", " ")}</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await supabase.from("fire_risk_actions").delete().eq("id", a.id);
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
              {actions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No findings recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={raOpen} onOpenChange={setRaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fire risk assessment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={raForm.title} onChange={(e) => setRaForm({ ...raForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date carried out</Label>
              <Input
                type="date"
                value={raForm.assessment_date}
                onChange={(e) => setRaForm({ ...raForm, assessment_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Review due</Label>
              <Input
                type="date"
                value={raForm.review_due}
                onChange={(e) => setRaForm({ ...raForm, review_due: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assessor</Label>
              <Input value={raForm.assessor} onChange={(e) => setRaForm({ ...raForm, assessor: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={4} value={raForm.summary} onChange={(e) => setRaForm({ ...raForm, summary: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRa}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add significant finding</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Finding</Label>
              <Textarea
                rows={2}
                value={actionForm.finding}
                onChange={(e) => setActionForm({ ...actionForm, finding: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Action required</Label>
              <Textarea
                rows={2}
                value={actionForm.action}
                onChange={(e) => setActionForm({ ...actionForm, action: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Input value={actionForm.owner} onChange={(e) => setActionForm({ ...actionForm, owner: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={actionForm.due_date}
                onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Priority</Label>
              <Select value={actionForm.priority} onValueChange={(v) => setActionForm({ ...actionForm, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAction}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FireRiskAssessmentPanel;
