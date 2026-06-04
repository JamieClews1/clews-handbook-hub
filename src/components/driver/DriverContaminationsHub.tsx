import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  AlertTriangle,
  Award,
  Loader2,
  Plus,
  Trophy,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DriverContaminationFlow, {
  ContaminationReporter,
} from "@/components/driver/DriverContaminationFlow";

interface MyReport {
  id: string;
  job_number: string;
  customer: string | null;
  site: string | null;
  contamination_type: string | null;
  status: string;
  approval_status: string;
  charge_amount: number | null;
  points_awarded: number | null;
  photos: string[] | null;
  created_at: string;
}

interface LeaderboardEntry {
  reporter_name: string;
  points: number;
  reports: number;
}

interface HubData {
  myReports: MyReport[];
  myPoints: number;
  leaderboard: LeaderboardEntry[];
}

type Tab = "reports" | "points";

const approvalStyle: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pending", cls: "bg-amber-500 text-white", Icon: Clock },
  approved: { label: "Approved", cls: "bg-emerald-600 text-white", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-500 text-white", Icon: XCircle },
};

const DriverContaminationsHub = ({
  reporter,
  userName,
  onLogout,
  nav,
}: {
  reporter: ContaminationReporter;
  userName?: string;
  onLogout?: () => void;
  nav?: React.ReactNode;
}) => {
  const [reporting, setReporting] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["driver-contaminations", reporter.id, reporter.name],
    queryFn: async (): Promise<HubData> => {
      const { data, error } = await supabase.functions.invoke("driver-contaminations", {
        body: { reporterId: reporter.type === "driver" ? reporter.id : null, reporterName: reporter.name },
      });
      if (error) throw error;
      return data as HubData;
    },
  });

  if (reporting) {
    return (
      <DriverContaminationFlow
        reporter={reporter}
        onBack={() => setReporting(false)}
        onSubmitted={() => {
          setReporting(false);
          refetch();
        }}
      />
    );
  }

  const myPoints = data?.myPoints ?? 0;
  const myReports = data?.myReports ?? [];
  const leaderboard = data?.leaderboard ?? [];
  const myRank = leaderboard.findIndex((e) => e.reporter_name === reporter.name);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="p-4 border-b-4 border-red-500 bg-red-500/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h1 className="text-2xl font-bold text-foreground">Contaminations</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {userName ? `${userName} · ` : ""}Report issues and track your reward points
            </p>
          </div>
          {onLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-muted-foreground h-10 w-10 shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>


      {/* Points summary */}
      <div className="p-4">
        <Card className="bg-amber-500/10 border-amber-500/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{myPoints}</p>
                <p className="text-xs text-muted-foreground">This month's points</p>
              </div>
            </div>
            {myRank >= 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">#{myRank + 1}</p>
                <p className="text-xs text-muted-foreground">Leaderboard</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report button */}
      <div className="px-4">
        <Button
          onClick={() => setReporting(true)}
          className="w-full h-16 text-lg font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl gap-3"
        >
          <Plus className="w-6 h-6" /> Report Contamination
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button
            onClick={() => setTab("reports")}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
              tab === "reports" ? "bg-background shadow text-foreground" : "text-muted-foreground",
            )}
          >
            <ClipboardList className="w-4 h-4" /> My Reports
          </button>
          <button
            onClick={() => setTab("points")}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
              tab === "points" ? "bg-background shadow text-foreground" : "text-muted-foreground",
            )}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && tab === "reports" && (
          <>
            {myReports.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No contamination reports yet. Tap "Report Contamination" to add your first one.
              </p>
            ) : (
              myReports.map((r) => {
                const a = approvalStyle[r.approval_status] || approvalStyle.pending;
                return (
                  <Card key={r.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground truncate">
                          {r.customer || "Unknown customer"}
                        </span>
                        <Badge className={cn("text-xs gap-1 shrink-0", a.cls)}>
                          <a.Icon className="w-3 h-3" /> {a.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">#{r.job_number}</span>
                        {r.contamination_type && <span>{r.contamination_type}</span>}
                        <span>{format(new Date(r.created_at), "d MMM yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        {r.photos && r.photos.length > 0 && (
                          <span className="text-xs text-muted-foreground">{r.photos.length} photo(s)</span>
                        )}
                        {typeof r.points_awarded === "number" && (
                          <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                            <Award className="w-3 h-3" /> +{r.points_awarded}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}

        {!isLoading && tab === "points" && (
          <>
            {leaderboard.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No points awarded yet this month.
              </p>
            ) : (
              leaderboard.map((e, i) => {
                const isMe = e.reporter_name === reporter.name;
                return (
                  <Card key={e.reporter_name} className={cn(isMe && "border-amber-500 bg-amber-500/5")}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                          i === 0
                            ? "bg-amber-400 text-white"
                            : i === 1
                            ? "bg-zinc-300 text-zinc-800"
                            : i === 2
                            ? "bg-amber-700 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {e.reporter_name} {isMe && <span className="text-xs text-amber-600">(You)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.reports} report(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{e.points}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
      {nav}
    </div>
  );
};

export default DriverContaminationsHub;
