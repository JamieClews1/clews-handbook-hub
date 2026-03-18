import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle2, RefreshCw, Scan, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, format } from "date-fns";

interface Props {
  onSelectQuery: (id: string) => void;
  onViewAll: () => void;
}

const statusColors: Record<string, string> = {
  query: "bg-red-500",
  actioned: "bg-amber-500",
  complete: "bg-green-500",
  resolved: "bg-muted",
};

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

const extractPostcode = (location: string | null | undefined): string | null => {
  if (!location) return null;
  const match = location.match(UK_POSTCODE_RE);
  return match ? match[1].toUpperCase().replace(/\s+/g, ' ').trim() : null;
};

const ContaminationsDashboard = ({ onSelectQuery, onViewAll }: Props) => {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);

  const { data: queries = [], refetch } = useQuery({
    queryKey: ["contamination-queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_queries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-contaminations"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const openQueries = queries.filter((q) => q.status === "query");
  const actionedQueries = queries.filter((q) => q.status === "actioned");
  const awaitingOver7Days = actionedQueries.filter(
    (q) => q.actioned_at && differenceInDays(new Date(), new Date(q.actioned_at)) >= 7
  );
  const resolvedThisWeek = queries.filter((q) => {
    if (q.status !== "resolved" && q.status !== "complete") return false;
    const resolved = q.resolved_at || q.completed_at;
    if (!resolved) return false;
    return differenceInDays(new Date(), new Date(resolved)) <= 7;
  });

  const avgResolutionTime = (() => {
    const resolved = queries.filter((q) => (q.status === "complete" || q.status === "resolved") && q.completed_at);
    if (resolved.length === 0) return null;
    const totalDays = resolved.reduce((sum, q) => {
      return sum + differenceInDays(new Date(q.completed_at!), new Date(q.created_at));
    }, 0);
    return Math.round(totalDays / resolved.length);
  })();

  // Group by owner
  const byOwner = openQueries.reduce<Record<string, number>>((acc, q) => {
    const name = q.owner_name || "Unassigned";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const handleScan = async () => {
    setScanning(true);
    try {
      // Fetch all Q-status jobs from data_hub_jobs not yet tracked
      const existingJobNumbers = queries.map((q) => q.job_number);

      let allQJobs: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("*")
          .eq("source", "skiptrak")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;

        const qJobs = data.filter(
          (j: any) => {
            const raw = j.raw as Record<string, any> | null;
            return raw?.Status === "Q" && !existingJobNumbers.includes(j.job_number);
          }
        );
        allQJobs.push(...qJobs);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      if (allQJobs.length === 0) {
        // Check for auto-resolve: existing queries whose jobs are no longer Q
        const activeQueries = queries.filter((q) => q.status === "query");
        let resolvedCount = 0;
        for (const aq of activeQueries) {
          const { data: jobData } = await supabase
            .from("data_hub_jobs")
            .select("raw")
            .eq("job_number", aq.job_number)
            .eq("source", "skiptrak")
            .maybeSingle();
          const rawD = jobData?.raw as Record<string, any> | null;
          if (jobData && rawD?.Status !== "Q") {
            await supabase
              .from("contamination_queries")
              .update({ status: "resolved", resolved_at: new Date().toISOString() })
              .eq("id", aq.id);
            await supabase.from("contamination_activity_log").insert({
              query_id: aq.id,
              user_id: user?.id,
              user_name: "System",
              action_type: "status_change",
              old_value: "query",
              new_value: "resolved",
              notes: "Auto-resolved: job no longer in Q status",
            });
            resolvedCount++;
          }
        }
        toast({
          title: "Scan Complete",
          description: `No new queries found. ${resolvedCount} auto-resolved.`,
        });
      } else {
        // Insert new queries
        const newQueries = allQJobs.map((j: any) => ({
          job_number: j.job_number,
          customer: j.customer,
          site: j.site,
          order_number: j.raw?.["Order No"] || j.order_number_override,
          query_reason: j.raw?.Description || j.waste_description,
          initial_cost: j.raw?.Cost ? parseFloat(j.raw.Cost) : null,
          container_type: j.container_type,
          waste_description: j.waste_description,
          weight_t: j.weight_t,
          job_date: j.job_date,
          vehicle_reg: j.vehicle_registration,
          data_hub_job_id: j.id,
          postcode: extractPostcode(j.tipping_location) || extractPostcode(j.raw?.Location),
          status: "query",
        }));

        const { error } = await supabase.from("contamination_queries").insert(newQueries);
        if (error) throw error;

        // Auto-resolve check
        const activeQueries = queries.filter((q) => q.status === "query");
        let resolvedCount = 0;
        for (const aq of activeQueries) {
          const { data: jobData } = await supabase
            .from("data_hub_jobs")
            .select("raw")
            .eq("job_number", aq.job_number)
            .eq("source", "skiptrak")
            .maybeSingle();
          const rawData = jobData?.raw as Record<string, any> | null;
          if (jobData && rawData?.Status !== "Q") {
            await supabase
              .from("contamination_queries")
              .update({ status: "resolved", resolved_at: new Date().toISOString() })
              .eq("id", aq.id);
            resolvedCount++;
          }
        }

        toast({
          title: "Scan Complete",
          description: `Found ${allQJobs.length} new queries. ${resolvedCount} auto-resolved.`,
        });
      }

      refetch();
    } catch (error: any) {
      toast({ title: "Scan Error", description: error.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scan Button */}
      <div className="flex justify-end">
        <Button onClick={handleScan} disabled={scanning} className="gap-2">
          {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
          {scanning ? "Scanning..." : "Scan for New Queries"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-3xl font-bold">{openQueries.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Response (7+ days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-3xl font-bold">{awaitingOver7Days.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-3xl font-bold">{resolvedThisWeek.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution (days)</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{avgResolutionTime ?? "—"}</span>
          </CardContent>
        </Card>
      </div>

      {/* Queries by Owner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Open Queries by Owner</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(byOwner).length === 0 ? (
            <p className="text-muted-foreground text-sm">No open queries</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(byOwner).map(([name, count]) => (
                <Badge key={name} variant="outline" className="text-sm py-1 px-3">
                  {name}: <span className="font-bold ml-1">{count as number}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Queries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Queries</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {queries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No contamination queries yet. Run a scan to detect Q-status jobs.</p>
          ) : (
            <div className="space-y-2">
              {queries.slice(0, 10).map((q) => (
                <div
                  key={q.id}
                  onClick={() => onSelectQuery(q.id)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[q.status]}`} />
                    <div>
                      <p className="font-medium text-sm">{q.job_number} — {q.customer}</p>
                      <p className="text-xs text-muted-foreground">{q.site}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={q.status === "query" ? "destructive" : q.status === "actioned" ? "secondary" : "default"} className="text-xs capitalize">
                      {q.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.created_at ? format(new Date(q.created_at), "dd/MM/yyyy") : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContaminationsDashboard;
