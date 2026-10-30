import InsightsFrame, { useInsightsPeriod } from "@/components/insights/InsightsFrame";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WasteValueSettings from "@/components/data-hub/WasteValueSettings";
import MidweighProductMappings from "@/components/data-hub/MidweighProductMappings";
import ZeroToLandfillChart from "@/components/data-hub/ZeroToLandfillChart";
import YardIncentives from "@/components/data-hub/YardIncentives";
import RecyclingIncentive from "@/components/data-hub/RecyclingIncentive";
export default function InsightsSettingsPage() {
  const { isAdmin, loading } = useAuth(); const { params, update } = useInsightsPeriod();
  if (loading) return null;
  if (!isAdmin) return <InsightsFrame title="Insights settings" description="Administrator access required" filters={false}><p>These settings are restricted to administrators.</p></InsightsFrame>;
  const requested = params.get("tab"); const tab = ["mappings", "groups", "schemes"].includes(requested ?? "") ? requested ?? "rates" : "rates";
  return <InsightsFrame title="Insights settings" description="Existing rates, waste mappings and bonus schemes" filters={false}><Tabs value={tab} onValueChange={tab => update({ tab })} className="space-y-5"><TabsList className="flex flex-wrap h-auto w-fit"><TabsTrigger value="rates">Rates & assumptions</TabsTrigger><TabsTrigger value="mappings">Product mappings</TabsTrigger><TabsTrigger value="groups">Waste groups</TabsTrigger><TabsTrigger value="schemes">Bonus schemes</TabsTrigger></TabsList><TabsContent value="rates"><WasteValueSettings /></TabsContent><TabsContent value="mappings"><MidweighProductMappings /></TabsContent><TabsContent value="groups"><p className="mb-3 text-sm text-muted-foreground">Waste groups are saved in this browser using the existing configuration. They are not a shared audited register.</p><ZeroToLandfillChart /></TabsContent><TabsContent value="schemes" className="space-y-5"><YardIncentives /><RecyclingIncentive /></TabsContent></Tabs></InsightsFrame>;
}