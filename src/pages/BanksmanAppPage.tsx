import { useCallback, useEffect, useMemo, useState } from "react";
import { driverAction } from "@/lib/driver-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  AlertTriangle,
  HardHat,
  Loader2,
  LogOut,
  RefreshCw,
  Scale,
  Truck,
  Weight,
  Package,
  ChevronRight,
  CheckCircle2,
  Search,
} from "lucide-react";
import DriverContaminationFlow from "@/components/driver/DriverContaminationFlow";

/* ─── Types ─── */
interface BanksmanUser {
  id: string;
  name: string;
}

interface WeighbridgeJob {
  id: string;
  job_number: string;
  source: string | null;
  customer: string | null;
  site: string | null;
  driver: string | null;
  vehicle_registration: string | null;
  container_type: string | null;
  waste_description: string | null;
  weight_t: number | null;
  job_date: string | null;
  ewc: string | null;
  movement_type: string | null;
  order_number_override: string | null;
  created_at: string;
  midweigh_job_number: string;
  skiptrak_job_number: string | null;
  has_contamination: boolean;
}

const SESSION_KEY = "banksman_session";

/* ─── PIN Login ─── */
const BanksmanLogin = ({ onLogin }: { onLogin: (u: BanksmanUser) => void }) => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !pin) {
      setError("Enter your username and PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { staff } = await driverAction("yard_login", {
        username: username.trim(),
        pin,
      });
      if (!staff) {
        setError("Invalid username or PIN");
        setLoading(false);
        return;
      }
      const user: BanksmanUser = { id: staff.id, name: staff.staff_name };
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: staff.id, ts: Date.now() }));
      onLogin(user);
    } catch (e) {
      setError((e as Error).message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/20 mb-2">
            <HardHat className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Banksman</h1>
          <p className="text-zinc-400 text-lg">Weighbridge Contaminations</p>
        </div>

        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">Username</label>
          <Input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="h-14 text-xl text-center bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>


        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold",
                  pin.length > i
                    ? "bg-amber-500/20 border-amber-500 text-amber-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600",
                )}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
            <Button
              key={key || "empty"}
              variant="ghost"
              disabled={key === ""}
              onClick={() => {
                if (key === "⌫") setPin((p) => p.slice(0, -1));
                else if (key !== "" && pin.length < 6) setPin((p) => p + key);
              }}
              className={cn(
                "h-16 text-2xl font-semibold rounded-xl",
                key === ""
                  ? "invisible"
                  : key === "⌫"
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    : "text-white hover:bg-zinc-800 bg-zinc-800/50",
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
          disabled={loading || !username.trim() || !pin}
          className="w-full h-16 text-xl font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
};

/* ─── Job Card ─── */
const JobCard = ({ job, onSelect }: { job: WeighbridgeJob; onSelect: () => void }) => (
  <button
    onClick={onSelect}
    className="w-full text-left bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground truncate">{job.customer || "Unknown customer"}</p>
        {job.site && <p className="text-sm text-muted-foreground truncate">{job.site}</p>}
      </div>
      {job.has_contamination ? (
        <Badge className="bg-emerald-600 text-white shrink-0 gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Reported
        </Badge>
      ) : (
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      )}
    </div>

    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {job.vehicle_registration && (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Truck className="w-4 h-4 text-muted-foreground" />
          {job.vehicle_registration}
        </span>
      )}
      {job.weight_t != null && (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Weight className="w-4 h-4 text-muted-foreground" />
          {job.weight_t} t
        </span>
      )}
      {job.container_type && (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Package className="w-4 h-4 text-muted-foreground" />
          {job.container_type}
        </span>
      )}
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
        <Scale className="w-3.5 h-3.5" /> Midweigh #{job.midweigh_job_number}
      </Badge>
      {job.skiptrak_job_number && (
        <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-700 dark:text-blue-400">
          <Truck className="w-3.5 h-3.5" /> Skiptrak #{job.skiptrak_job_number}
        </Badge>
      )}
    </div>

    {job.waste_description && (
      <p className="mt-2 text-xs text-muted-foreground truncate">{job.waste_description}</p>
    )}
  </button>
);

/* ─── Feed ─── */
const BanksmanFeed = ({ user, onLogout }: { user: BanksmanUser; onLogout: () => void }) => {
  const [jobs, setJobs] = useState<WeighbridgeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WeighbridgeJob | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { jobs: data } = await driverAction("list_weighbridge_jobs", {});
      setJobs(data ?? []);
    } catch (e) {
      // keep previous data on error
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 20000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [
        j.customer,
        j.site,
        j.vehicle_registration,
        j.midweigh_job_number,
        j.skiptrak_job_number,
        j.waste_description,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [jobs, search]);

  if (selected) {
    return (
      <DriverContaminationFlow
        reporter={{ id: user.id, name: user.name, type: "yard" }}
        job={{
          id: selected.id,
          job_number: selected.midweigh_job_number,
          customer_name: selected.customer || "",
          site_name: selected.site,
          site_postcode: null,
          container_type: selected.container_type,
          po_number: selected.order_number_override ?? null,
          order_number: selected.order_number_override ?? null,
          job_date: selected.job_date ?? null,
          waste_description: selected.waste_description ?? null,
          weight_t: selected.weight_t ?? null,
          vehicle_reg: selected.vehicle_registration ?? null,
        }}
        onBack={() => {
          setSelected(null);
          load(true);
        }}
        onSubmitted={() => {
          setSelected(null);
          load(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-bold text-foreground leading-tight">Weighbridge Feed</p>
              <p className="text-xs text-muted-foreground leading-tight">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reg, customer, job number…"
              className="pl-9 h-11"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p>Loading weighbridge jobs…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
            <Scale className="w-10 h-10 mb-3 opacity-50" />
            <p className="font-medium">No weighbridge jobs</p>
            <p className="text-sm">Jobs coming through the weighbridge will appear here.</p>
          </div>
        ) : (
          filtered.map((job) => (
            <JobCard key={job.id} job={job} onSelect={() => setSelected(job)} />
          ))
        )}
      </div>
    </div>
  );
};

/* ─── Root ─── */
const BanksmanAppPage = () => {
  const [user, setUser] = useState<BanksmanUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    document.title = "Banksman | WasteOne";
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      setRestoring(false);
      return;
    }
    try {
      const { id } = JSON.parse(raw);
      if (!id) {
        setRestoring(false);
        return;
      }
      driverAction("yard_restore", { id })
        .then(({ staff }) => {
          if (staff) setUser({ id: staff.id, name: staff.staff_name });
          else localStorage.removeItem(SESSION_KEY);
        })
        .catch(() => localStorage.removeItem(SESSION_KEY))
        .finally(() => setRestoring(false));
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setRestoring(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <BanksmanLogin onLogin={setUser} />;
  return <BanksmanFeed user={user} onLogout={handleLogout} />;
};

export default BanksmanAppPage;
