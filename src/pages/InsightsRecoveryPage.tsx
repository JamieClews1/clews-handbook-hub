import InsightsFrame, { useInsightsPeriod } from "@/components/insights/InsightsFrame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import WasteKPIGradeCWood from "@/components/data-hub/WasteKPIGradeCWood";
import WasteRecoverySavings from "@/components/data-hub/WasteRecoverySavings";
import MeasuredRecoverySavings from "@/components/insights/MeasuredRecoverySavings";
import YardIncentives from "@/components/data-hub/YardIncentives";
import RecyclingIncentive from "@/components/data-hub/RecyclingIncentive";
import { parseLoadReportDate } from "@/lib/load-report-dates";
export default function InsightsRecoveryPage() {
  const { period, params, update } = useInsightsPeriod(); const start = parseLoadReportDate(period.start); const end = parseLoadReportDate(period.end);
  if (!start || !end) return null;
  const requested = params.get("tab"); const tab = requested === "savings" || requested === "incentives" ? requested : "wood";
  return <InsightsFrame title="Recovery & incentives" description="What sorting saved, and the monthly yard bonus estimates">
    <Tabs value={tab} onValueChange={tab => update({ tab })} className="space-y-5"><TabsList className="flex flex-wrap h-auto w-fit"><TabsTrigger value="wood">Wood recovery</TabsTrigger><TabsTrigger value="savings">Recovery savings</TabsTrigger><TabsTrigger value="incentives">Yard incentives</TabsTrigger></TabsList>
      <TabsContent value="wood"><WasteKPIGradeCWood externalStartDate={start} externalEndDate={end} /></TabsContent>
      <TabsContent value="savings" className="space-y-6"><MeasuredRecoverySavings start={period.start} end={period.end} /><details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">Existing waste-mix model</summary><div className="mt-4"><WasteRecoverySavings externalStartDate={start} externalEndDate={end} /></div></details></TabsContent>
      <TabsContent value="incentives" className="space-y-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Fixed: selected bonus month</Badge><p className="text-xs text-muted-foreground">Monthly scheme calculations do not follow the page range. Pools are estimates, not confirmation of payment.</p></div><YardIncentives hideSettings /><RecyclingIncentive hideSettings /></TabsContent>
    </Tabs>
  </InsightsFrame>;
}