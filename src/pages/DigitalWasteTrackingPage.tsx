import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Search, Truck, Weight, Package, Info, Radio, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";
import { Json } from "@/integrations/supabase/types";

interface Row {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  driver: string | null;
  vehicle_registration: string | null;
  waste_description: string | null;
  ewc: string | null;
  container_type: string | null;
  weight_t: number | null;
  movement_type: string | null;
  raw: Json;
}

const DigitalWasteTrackingPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dwt-inbound", date],
    queryFn: async () => {
      const all: Row[] = [];
      let from = 0;
      const ps = 1000;
      let more = true;
      while (more) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, job_date, customer, site, driver, vehicle_registration, waste_description, ewc, container_type, weight_t, movement_type, raw")
          .eq("source", "midweigh")
          .eq("job_date", date)
          .order("job_number", { ascending: false })
          .range(from, from + ps - 1);
        if (error) throw error;
        if (data) all.push(...(data as Row[]));
        more = (data?.length ?? 0) === ps;
        from += ps;
      }
      // Inbound only — waste received onto site
      return all.filter((r) => {
        const mt = (r.movement_type ?? "").toUpperCase();
        return mt === "" || mt === "INWARD" || mt === "IN" || mt.includes("IN");
      });
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.job_number, r.customer, r.site, r.vehicle_registration, r.waste_description, r.ewc, r.driver]
        .some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [rows, search]);

  const totalWeight = useMemo(
    () => filtered.reduce((sum, r) => sum + (r.weight_t ? Number(r.weight_t) / 1000 : 0), 0),
    [filtered]
  );
  const uniqueEwc = useMemo(
    () => new Set(filtered.map((r) => (r.ewc ?? "").trim()).filter(Boolean)).size,
    [filtered]
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const rawField = (raw: Json, keys: string[]): string => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (v != null && v !== "") return String(v);
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/portal">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Portal</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">Digital Waste Tracking</h1>
                <Badge variant="outline" className="gap-1.5">
                  <Radio className="h-3 w-3" /> API not connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Daily record of every waste job received into Clews Recycling (Midweigh). From 1st October
                this dataset will be submitted live to the government Digital Waste Tracking (DWT) service
                via the Receipt of Waste API.
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Phase 1 — Receipt of Waste (RoW)</AlertTitle>
            <AlertDescription>
              As the waste receiver we must submit each accepted load at the point of receipt. This screen
              is the source of truth that will POST to the DWT <code>ReceiptDataset()</code> endpoint,
              returning a <strong>WT-ID</strong> per movement. The API link will be added in a later step —
              for now we are proving the daily dataset is complete and correct.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard icon={Truck} label="Loads received" value={filtered.length.toString()} />
            <StatCard icon={Weight} label="Total weight" value={`${totalWeight.toFixed(3)} t`} />
            <StatCard icon={Package} label="Unique EWC codes" value={uniqueEwc.toString()} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[170px]"
                max={format(new Date(), "yyyy-MM-dd")}
              />
              <Button variant="outline" size="sm" onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}>
                Today
              </Button>
            </div>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search job, customer, vehicle, EWC, waste..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading incoming loads…</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No Midweigh loads received on {format(parseISO(date), "EEE d MMM yyyy")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Ticket #</th>
                        <th className="text-left px-3 py-2 font-medium">Time</th>
                        <th className="text-left px-3 py-2 font-medium">Customer / Producer</th>
                        <th className="text-left px-3 py-2 font-medium">Vehicle</th>
                        <th className="text-left px-3 py-2 font-medium">Carrier Registration</th>
                        <th className="text-left px-3 py-2 font-medium">Carrier Name</th>
                        <th className="text-left px-3 py-2 font-medium">Physical Form</th>
                        <th className="text-left px-3 py-2 font-medium">EWC</th>
                        <th className="text-left px-3 py-2 font-medium">Waste description</th>
                        <th className="text-left px-3 py-2 font-medium">Container</th>
                        <th className="text-right px-3 py-2 font-medium">Weight (t)</th>
                        <th className="text-left px-3 py-2 font-medium">DWT status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const time = rawField(r.raw, ["Time In", "TimeIn", "Time", "Weigh In Time", "In Time"]);
                        const carrier = rawField(r.raw, ["Carrier", "Haulier", "Carrier Name", "Transport"]);
                        return (
                          <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono font-semibold">{r.job_number}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{time || "—"}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.customer || "—"}</div>
                              {r.site && <div className="text-xs text-muted-foreground">{r.site}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.vehicle_registration || "—"}</td>
                            <td className="px-3 py-2">{carrier || "—"}</td>
                            <td className="px-3 py-2 font-mono">{r.ewc || "—"}</td>
                            <td className="px-3 py-2">{r.waste_description || "—"}</td>
                            <td className="px-3 py-2">{r.container_type || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              {r.weight_t != null ? (Number(r.weight_t) / 1000).toFixed(3) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="secondary" className="text-[10px]">Pending API</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t border-border/50 font-semibold">
                      <tr>
                        <td className="px-3 py-2" colSpan={8}>Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{totalWeight.toFixed(3)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Data source: Midweigh weighbridge (data_hub_jobs). Once the DWT Receipt of Waste API is
            connected, each row will POST automatically at the point of receipt and store its returned
            WT-ID against the ticket.
          </p>
        </div>
      </main>
    </div>
  );
};

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DigitalWasteTrackingPage;
