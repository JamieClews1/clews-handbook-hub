import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import InsightsFrame, { useInsightsPeriod } from "@/components/insights/InsightsFrame";
import OutgoingWastes from "@/components/data-hub/OutgoingWastes";
import TotalWasteHandled from "@/components/data-hub/TotalWasteHandled";
import WasteOnsiteOffsite from "@/components/data-hub/WasteOnsiteOffsite";
import ZeroToLandfillChart from "@/components/data-hub/ZeroToLandfillChart";
import { parseLoadReportDate } from "@/lib/load-report-dates";
export default function WasteKPIsPage() {
  const { period, previous, params, update } = useInsightsPeriod();
  const start = parseLoadReportDate(period.start); const end = parseLoadReportDate(period.end);
  if (!start || !end) return null;
  const ps = previous ? parseLoadReportDate(previous.start) : null; const pe = previous ? parseLoadReportDate(previous.end) : null;
  const ranges = ps && pe ? [{ year: ps.getUTCFullYear(), start: ps, end: pe }] : [];
  const requested = params.get("tab"); const tab = requested === "in" || requested === "zero" || requested === "destinations" ? requested : "out";
  return <InsightsFrame title="Waste flows" description="What came in, and where it went">
    <Tabs value={tab} onValueChange={tab => update({ tab })} className="space-y-5"><TabsList className="flex flex-wrap h-auto w-fit"><TabsTrigger value="in">In</TabsTrigger><TabsTrigger value="out">Out</TabsTrigger><TabsTrigger value="zero">Zero to landfill</TabsTrigger><TabsTrigger value="destinations">Destinations</TabsTrigger></TabsList>
      <TabsContent value="in" className="space-y-5"><TotalWasteHandled externalStartDate={start} externalEndDate={end} comparisonRanges={ranges} /><WasteOnsiteOffsite externalStartDate={start} externalEndDate={end} comparisonRanges={ranges} /></TabsContent>
      <TabsContent value="out"><OutgoingWastes externalStartDate={start} externalEndDate={end} comparisonStartDate={ps ?? undefined} comparisonEndDate={pe ?? undefined} compare={Boolean(previous)} /></TabsContent>
      <TabsContent value="destinations"><OutgoingWastes externalStartDate={start} externalEndDate={end} comparisonStartDate={ps ?? undefined} comparisonEndDate={pe ?? undefined} compare={Boolean(previous)} view="destinations" /></TabsContent>
      <TabsContent value="zero" className="space-y-4"><p className="text-sm text-muted-foreground">Outward-movement trend · existing configured waste groups. This scope differs from the all-unit WASTEOUT totals on Out.</p><ZeroToLandfillChart externalStartDate={start} externalEndDate={end} hideSettings /><Button asChild variant="outline"><Link to="/performance-hub/insights-settings?tab=groups">Waste group settings</Link></Button></TabsContent>
    </Tabs>
  </InsightsFrame>;
}