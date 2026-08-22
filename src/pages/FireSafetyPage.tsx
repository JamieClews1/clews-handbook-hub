import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Flame } from "lucide-react";
import HSDocumentsPage from "./HSDocumentsPage";
import FirePeoplePanel from "@/components/fire-safety/FirePeoplePanel";
import FireWeeklyTestsPanel from "@/components/fire-safety/FireWeeklyTestsPanel";
import FireEquipmentChecksPanel from "@/components/fire-safety/FireEquipmentChecksPanel";
import FireDrillsPanel from "@/components/fire-safety/FireDrillsPanel";
import FireRiskAssessmentPanel from "@/components/fire-safety/FireRiskAssessmentPanel";
import { ASSEMBLY_POINT, addDays, fireRoleLabel, fmt } from "@/lib/fire-safety";

interface Stat {
  label: string;
  value: string;
  detail: string;
  bad: boolean;
}

const FireSafetyPage = () => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [leads, setLeads] = useState<{ role: string; names: string[] }[]>([]);

  useEffect(() => {
    const run = async () => {
      const [{ data: tests }, { data: drills }, { data: checks }, { data: actions }, { data: people }] =
        await Promise.all([
          supabase.from("fire_weekly_tests").select("test_date").order("test_date", { ascending: false }).limit(1),
          supabase.from("fire_drills").select("drill_date").order("drill_date", { ascending: false }).limit(1),
          supabase.from("fire_equipment_checks").select("last_checked_on, frequency_days").eq("is_active", true),
          supabase.from("fire_risk_actions").select("status, due_date"),
          supabase.from("fire_safety_people").select("role, full_name").eq("is_active", true).order("sort_order"),
        ]);

      const lastTest = tests?.[0]?.test_date as string | undefined;
      const testDays = lastTest
        ? Math.floor((Date.now() - new Date(`${lastTest}T00:00:00Z`).getTime()) / 86400000)
        : null;
      const lastDrill = drills?.[0]?.drill_date as string | undefined;
      const drillDue = lastDrill ? addDays(lastDrill, 182) : null;
      const overdueChecks = (checks || []).filter(
        (c) => !c.last_checked_on || addDays(c.last_checked_on as string, c.frequency_days).getTime() < Date.now()
      ).length;
      const overdueActions = (actions || []).filter(
        (a) => a.status !== "complete" && a.due_date && new Date(`${a.due_date}T00:00:00Z`).getTime() < Date.now()
      ).length;

      setStats([
        {
          label: "Weekly alarm test",
          value: testDays === null ? "Never" : `${testDays}d ago`,
          detail: lastTest ? fmt(lastTest) : "No test logged",
          bad: testDays === null || testDays > 7,
        },
        {
          label: "Next fire drill",
          value: drillDue ? drillDue.toLocaleDateString("en-GB") : "Due now",
          detail: lastDrill ? `Last ${fmt(lastDrill)}` : "No drill recorded",
          bad: !drillDue || drillDue.getTime() < Date.now(),
        },
        {
          label: "Equipment checks overdue",
          value: String(overdueChecks),
          detail: `${(checks || []).length} recurring checks`,
          bad: overdueChecks > 0,
        },
        {
          label: "Risk actions overdue",
          value: String(overdueActions),
          detail: `${(actions || []).filter((a) => a.status !== "complete").length} open findings`,
          bad: overdueActions > 0,
        },
      ]);

      const grouped: Record<string, string[]> = {};
      (people || []).forEach((p) => {
        grouped[p.role as string] = [...(grouped[p.role as string] || []), p.full_name as string];
      });
      setLeads(Object.entries(grouped).map(([role, names]) => ({ role, names })));
    };
    run();
  }, []);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Flame className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fire Safety</h1>
          <p className="text-muted-foreground">
            The safety hub for Unit 17 — responsible people, fire plan and risk assessment, weekly and periodic
            checks, drills and signed documents.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={s.bad ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardContent className="space-y-1 py-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                {s.bad ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="grid gap-4 py-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              In an emergency
            </p>
            <p className="text-sm">
              Raise the alarm, evacuate, and go to the Fire Assembly Point: <strong>{ASSEMBLY_POINT}</strong>. Do
              not re-enter until a marshal or manager says it is safe.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who to find</p>
            <ul className="text-sm">
              {leads.map((l) => (
                <li key={l.role}>
                  <span className="text-muted-foreground">{fireRoleLabel(l.role)}:</span> {l.names.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documents">
        <TabsList className="flex-wrap">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="weekly">Weekly test</TabsTrigger>
          <TabsTrigger value="checks">Equipment checks</TabsTrigger>
          <TabsTrigger value="drills">Fire drills</TabsTrigger>
          <TabsTrigger value="risk">Risk assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <HSDocumentsPage
            category="fire_safety"
            heading="Fire Safety"
            description="Fire safety plan, prevention, alarm procedure and assembly point."
            hideHeader
          />
        </TabsContent>
        <TabsContent value="people" className="mt-4">
          <FirePeoplePanel />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <FireWeeklyTestsPanel />
        </TabsContent>
        <TabsContent value="checks" className="mt-4">
          <FireEquipmentChecksPanel />
        </TabsContent>
        <TabsContent value="drills" className="mt-4">
          <FireDrillsPanel />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <FireRiskAssessmentPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FireSafetyPage;
