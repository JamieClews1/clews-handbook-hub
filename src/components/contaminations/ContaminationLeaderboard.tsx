import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, ChevronLeft, ChevronRight, Trophy, Medal } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface PointsRow {
  id: string;
  reporter_name: string;
  points: number;
  awarded_at: string;
  reason: string | null;
}

const ContaminationLeaderboard = () => {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));

  const start = useMemo(() => startOfMonth(monthDate).toISOString(), [monthDate]);
  const end = useMemo(() => endOfMonth(monthDate).toISOString(), [monthDate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contamination-points", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_points")
        .select("id, reporter_name, points, awarded_at, reason")
        .gte("awarded_at", start)
        .lte("awarded_at", end)
        .order("awarded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PointsRow[];
    },
  });

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; points: number; reports: number }>();
    for (const r of rows) {
      const key = r.reporter_name || "Unknown";
      const existing = map.get(key) || { name: key, points: 0, reports: 0 };
      existing.points += r.points;
      existing.reports += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.points - a.points);
  }, [rows]);

  const totalPoints = leaderboard.reduce((s, l) => s + l.points, 0);
  const totalReports = rows.length;

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (i === 1) return <Medal className="h-5 w-5 text-zinc-400" />;
    if (i === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Reward Points Leaderboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthDate((d) => addMonths(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center font-medium">{format(monthDate, "MMMM yyyy")}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthDate((d) => addMonths(d, 1))}
            disabled={startOfMonth(addMonths(monthDate, 1)) > startOfMonth(new Date())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalPoints}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalReports}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{leaderboard.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contamination reports logged this month yet.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((l, i) => (
                <div
                  key={l.name}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                    <div>
                      <p className="font-medium text-sm">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.reports} report{l.reports !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-base font-bold gap-1">
                    <Award className="h-4 w-4" /> {l.points}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContaminationLeaderboard;
