import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  MapPin,
  Clock,
  ChevronRight,
  ChevronLeft,
  Navigation,
  Package,
  AlertTriangle,
  User,
  Hash,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ───────────────────────────────────── */
type JobType = "delivery" | "exchange" | "collection" | "waste_truck" | "wasted_journey";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
};

const JOB_TYPE_COLORS: Record<JobType, { bg: string; border: string; text: string; badge: string }> = {
  delivery:       { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-700", badge: "bg-emerald-500 text-white" },
  exchange:       { bg: "bg-amber-400/10",   border: "border-amber-400",   text: "text-amber-700",   badge: "bg-amber-400 text-white" },
  collection:     { bg: "bg-orange-500/10",  border: "border-orange-500",  text: "text-orange-700",  badge: "bg-orange-500 text-white" },
  waste_truck:    { bg: "bg-blue-500/10",    border: "border-blue-500",    text: "text-blue-700",    badge: "bg-blue-500 text-white" },
  wasted_journey: { bg: "bg-red-500/10",     border: "border-red-500",     text: "text-red-700",     badge: "bg-red-500 text-white" },
};

interface Driver {
  id: string;
  driver_name: string;
  driver_number: number | null;
  pin: string | null;
  vehicle_id: string | null;
  route_one_vehicles: { registration: string; vehicle_type: string } | null;
}

interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  site_name: string | null;
  site_address: string | null;
  site_postcode: string | null;
  job_type: JobType;
  container_type: string | null;
  container_size: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
  po_number: string | null;
}

/* ─── PIN Login Screen ────────────────────────── */
const DriverLogin = ({ onLogin }: { onLogin: (driver: Driver) => void }) => {
  const [driverNumber, setDriverNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!driverNumber || !pin) {
      setError("Enter your driver number and PIN");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error: dbError } = await supabase
      .from("route_one_drivers")
      .select("*, route_one_vehicles(registration, vehicle_type)")
      .eq("driver_number", parseInt(driverNumber))
      .eq("pin", pin)
      .eq("is_active", true)
      .maybeSingle();

    if (dbError || !data) {
      setError("Invalid driver number or PIN");
      setLoading(false);
      return;
    }

    localStorage.setItem("driver_session", JSON.stringify({ id: data.id, ts: Date.now() }));
    onLogin(data as Driver);
    setLoading(false);
  };

  const handlePinButton = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo area */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/20 mb-4">
            <Truck className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">RouteOne</h1>
          <p className="text-zinc-400 text-lg">Driver Login</p>
        </div>

        {/* Driver Number */}
        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">Driver Number</label>
          <Input
            type="number"
            inputMode="numeric"
            value={driverNumber}
            onChange={(e) => setDriverNumber(e.target.value)}
            placeholder="Enter driver number"
            className="h-14 text-xl text-center bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        {/* PIN Display */}
        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold",
                  pin.length > i
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600"
                )}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
        </div>

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
            <Button
              key={key || "empty"}
              variant="ghost"
              disabled={key === ""}
              onClick={() => {
                if (key === "⌫") setPin((p) => p.slice(0, -1));
                else if (key !== "") handlePinButton(key);
              }}
              className={cn(
                "h-16 text-2xl font-semibold rounded-xl",
                key === ""
                  ? "invisible"
                  : key === "⌫"
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  : "text-white hover:bg-zinc-800 bg-zinc-800/50"
              )}
            >
              {key}
            </Button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          onClick={handleLogin}
          disabled={loading || !driverNumber || !pin}
          className="w-full h-16 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
};

/* ─── Job Card ────────────────────────────────── */
const DriverJobCard = ({ job, onClick }: { job: Job; onClick: () => void }) => {
  const colors = JOB_TYPE_COLORS[job.job_type] || JOB_TYPE_COLORS.delivery;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-l-4 cursor-pointer active:scale-[0.98] transition-transform",
        colors.border,
        colors.bg
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs font-bold", colors.badge)}>
                {JOB_TYPE_LABELS[job.job_type]}
              </Badge>
              {job.status === "query" && (
                <Badge className="bg-red-500 text-white text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Query
                </Badge>
              )}
              {job.scheduled_time && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {job.scheduled_time}
                </span>
              )}
            </div>

            <h3 className="font-bold text-base text-foreground truncate">{job.customer_name}</h3>

            {job.site_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{job.site_name}</span>
              </p>
            )}

            {job.container_type && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 shrink-0" />
                {job.container_type}
                {job.container_size && ` · ${job.container_size}`}
              </p>
            )}
          </div>
          <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Job Detail Screen ───────────────────────── */
const DriverJobDetail = ({ job, onBack }: { job: Job; onBack: () => void }) => {
  const colors = JOB_TYPE_COLORS[job.job_type] || JOB_TYPE_COLORS.delivery;

  const handleNavigate = () => {
    const address = job.site_postcode || job.site_address || job.site_name || "";
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={cn("p-4 border-b-4", colors.border, colors.bg)}>
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-3 active:opacity-70">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Jobs</span>
        </button>
        <div className="flex items-center gap-3">
          <Badge className={cn("text-sm font-bold py-1 px-3", colors.badge)}>
            {JOB_TYPE_LABELS[job.job_type]}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{job.job_number}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-2">{job.customer_name}</h1>
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* Location */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Location</h2>
            {job.site_name && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">{job.site_name}</p>
                  {job.site_address && <p className="text-sm text-muted-foreground">{job.site_address}</p>}
                  {job.site_postcode && <p className="text-sm text-muted-foreground font-mono">{job.site_postcode}</p>}
                </div>
              </div>
            )}
            <Button
              onClick={handleNavigate}
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-3"
              disabled={!job.site_postcode && !job.site_address && !job.site_name}
            >
              <Navigation className="w-6 h-6" />
              Navigate to Site
            </Button>
          </CardContent>
        </Card>

        {/* Job Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Job Details</h2>
            <div className="grid grid-cols-2 gap-3">
              {job.container_type && (
                <InfoItem label="Container" value={`${job.container_type}${job.container_size ? ` · ${job.container_size}` : ""}`} />
              )}
              {job.waste_type && <InfoItem label="Waste Type" value={job.waste_type} />}
              {job.ewc_code && <InfoItem label="EWC Code" value={job.ewc_code} />}
              {job.po_number && <InfoItem label="PO Number" value={job.po_number} />}
              {job.scheduled_time && <InfoItem label="Scheduled" value={job.scheduled_time} />}
            </div>
            {job.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Notes</p>
                <p className="text-sm text-foreground">{job.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3 pb-8">
          <Button
            className="w-full h-16 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
          >
            Start Job
          </Button>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

/* ─── Jobs Dashboard ──────────────────────────── */
const DriverDashboard = ({ driver, onLogout }: { driver: Driver; onLogout: () => void }) => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["driver-jobs", driver.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_jobs")
        .select("*")
        .eq("assigned_driver_id", driver.id)
        .eq("scheduled_date", today)
        .order("scheduled_time", { ascending: true, nullsFirst: false })
        .order("display_order");
      if (error) throw error;
      return (data || []) as Job[];
    },
    refetchInterval: 30000, // refresh every 30s
  });

  if (selectedJob) {
    return <DriverJobDetail job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-zinc-900 text-white p-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{driver.driver_name}</p>
              {driver.route_one_vehicles && (
                <p className="text-zinc-400 text-sm">
                  {driver.route_one_vehicles.registration} · {driver.route_one_vehicles.vehicle_type}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-12 w-12"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-400 text-sm">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
            <p className="text-2xl font-bold mt-1">
              {jobs.length} Job{jobs.length !== 1 ? "s" : ""} Today
            </p>
          </div>
          {jobs.length > 0 && (
            <div className="text-right">
              <p className="text-zinc-400 text-xs">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">
                {completedCount}/{jobs.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Truck className="w-16 h-16 text-muted-foreground mx-auto opacity-30" />
            <p className="text-xl font-semibold text-muted-foreground">No jobs assigned</p>
            <p className="text-sm text-muted-foreground">Check back later for new assignments</p>
          </div>
        ) : (
          jobs.map((job) => (
            <DriverJobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
          ))
        )}
      </div>
    </div>
  );
};

/* ─── Main Page ───────────────────────────────── */
const DriverAppPage = () => {
  const [driver, setDriver] = useState<Driver | null>(null);

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem("driver_session");
    if (stored) {
      try {
        const { id, ts } = JSON.parse(stored);
        // Session valid for 14 hours (one shift)
        if (Date.now() - ts < 14 * 60 * 60 * 1000) {
          supabase
            .from("route_one_drivers")
            .select("*, route_one_vehicles(registration, vehicle_type)")
            .eq("id", id)
            .eq("is_active", true)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setDriver(data as Driver);
              else localStorage.removeItem("driver_session");
            });
        } else {
          localStorage.removeItem("driver_session");
        }
      } catch {
        localStorage.removeItem("driver_session");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("driver_session");
    setDriver(null);
  };

  if (!driver) {
    return <DriverLogin onLogin={setDriver} />;
  }

  return <DriverDashboard driver={driver} onLogout={handleLogout} />;
};

export default DriverAppPage;
