import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Check,
  Clock,
  AlertTriangle,
  Camera,
  ExternalLink,
  Copy,
  Shield,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const DriverAppManagement = () => {
  const appUrl = `${window.location.origin}/driver`;

  // Get all drivers with PINs set
  const { data: drivers = [] } = useQuery({
    queryKey: ["driver-app-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_drivers")
        .select("id, driver_name, driver_number, pin, is_active, route_one_vehicles(registration, vehicle_type)")
        .eq("is_active", true)
        .order("driver_name");
      if (error) throw error;
      return data;
    },
  });

  // Get today's job stats per driver
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: jobStats = [] } = useQuery({
    queryKey: ["driver-app-job-stats", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_jobs")
        .select("assigned_driver_id, status")
        .eq("scheduled_date", today)
        .not("assigned_driver_id", "is", null);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Get recent photos count
  const { data: recentPhotos = 0 } = useQuery({
    queryKey: ["driver-app-photos-today", today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("route_one_job_photos")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const copyAppUrl = () => {
    navigator.clipboard.writeText(appUrl);
    toast.success("Driver App URL copied to clipboard");
  };

  const driversWithPin = drivers.filter((d: any) => d.pin);
  const driversWithoutPin = drivers.filter((d: any) => !d.pin);

  const getDriverStats = (driverId: string) => {
    const driverJobs = jobStats.filter((j: any) => j.assigned_driver_id === driverId);
    const total = driverJobs.length;
    const completed = driverJobs.filter((j: any) => j.status === "completed").length;
    const inProgress = driverJobs.filter((j: any) => j.status === "in_progress").length;
    const queries = driverJobs.filter((j: any) => j.status === "query").length;
    return { total, completed, inProgress, queries };
  };

  return (
    <div className="space-y-6">
      {/* App URL Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Driver App URL
          </CardTitle>
          <CardDescription>Share this URL with drivers to access the mobile app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
              {appUrl}
            </code>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyAppUrl}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
              <a href={appUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Drivers can bookmark this URL or add it to their home screen for quick access. Sessions remain active for 14 hours (one shift).
          </p>
        </CardContent>
      </Card>

      {/* Today's Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today's Activity
          </CardTitle>
          <CardDescription>{format(new Date(), "EEEE, d MMMM yyyy")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{jobStats.length}</p>
              <p className="text-xs text-muted-foreground">Total Jobs</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-600">
                {jobStats.filter((j: any) => j.status === "completed").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10">
              <p className="text-2xl font-bold text-blue-600">
                {jobStats.filter((j: any) => j.status === "in_progress").length}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
                <Camera className="h-4 w-4" />
                {recentPhotos}
              </p>
              <p className="text-xs text-muted-foreground">Photos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Access Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Driver Access
          </CardTitle>
          <CardDescription>
            {driversWithPin.length} of {drivers.length} active drivers have a PIN configured
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="w-20 text-center">PIN</TableHead>
                <TableHead className="text-center">Today's Jobs</TableHead>
                <TableHead className="text-center">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d: any) => {
                const stats = getDriverStats(d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{d.driver_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{d.driver_name}</TableCell>
                    <TableCell>
                      {d.route_one_vehicles ? (
                        <span className="text-xs font-mono">{d.route_one_vehicles.registration}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {d.pin ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40 gap-1">
                          <KeyRound className="h-3 w-3" />
                          Set
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-400/40 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stats.total > 0 ? (
                        <span className="font-semibold">{stats.total}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stats.total > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">
                            {stats.completed}/{stats.total}
                          </span>
                          {stats.queries > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              {stats.queries} Q
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {drivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No active drivers. Add drivers in the Drivers tab first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warnings */}
      {driversWithoutPin.length > 0 && (
        <Card className="border-amber-400/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {driversWithoutPin.length} driver{driversWithoutPin.length !== 1 ? "s" : ""} without a PIN
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  These drivers cannot log in to the mobile app. Set a PIN in the Drivers tab: {" "}
                  {driversWithoutPin.map((d: any) => d.driver_name).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
