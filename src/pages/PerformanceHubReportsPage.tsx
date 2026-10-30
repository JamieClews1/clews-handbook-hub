import { Link } from "react-router-dom";
import InsightsFrame, { useInsightsPeriod } from "@/components/insights/InsightsFrame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import DataHubAIChat from "@/components/data-hub/DataHubAIChat";
import DataHubAnalytics from "@/components/data-hub/DataHubAnalytics";
import WasteNotOnMidweigh from "@/components/data-hub/WasteNotOnMidweigh";
import { parseLoadReportDate } from "@/lib/load-report-dates";
export default function PerformanceHubReportsPage() {
  const { period, params, update } = useInsightsPeriod(); const start = parseLoadReportDate(period.start); const end = parseLoadReportDate(period.end);
  if (!start || !end) return null;
  const requested = params.get("tab"); const tab = requested === "tracking" || requested === "ask-ai" ? requested : "quality";
  return <InsightsFrame title="Data checks" description="Is the reporting data complete and right?">
    <p className="text-sm text-muted-foreground">Uploads, archives, PODs and live activity remain on the existing Data Uploads page.</p>
    <Button asChild variant="outline" className="w-fit"><Link to="/performance-hub/data">Open Data Uploads</Link></Button>
    <Tabs value={tab} onValueChange={tab => update({ tab })} className="space-y-5"><TabsList className="flex flex-wrap h-auto w-fit"><TabsTrigger value="quality">Quality checks</TabsTrigger><TabsTrigger value="tracking">Data tracking</TabsTrigger><TabsTrigger value="ask-ai">Ask AI</TabsTrigger></TabsList>
      <TabsContent value="quality"><WasteNotOnMidweigh externalStartDate={start} externalEndDate={end} /></TabsContent>
      <TabsContent value="tracking"><DataHubAnalytics externalStartDate={start} externalEndDate={end} /></TabsContent>
      <TabsContent value="ask-ai"><p className="mb-3 text-xs text-muted-foreground">Ask AI searches data according to your question; the page period is not applied automatically.</p><DataHubAIChat /></TabsContent>
    </Tabs>
  </InsightsFrame>;
}