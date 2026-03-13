import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, ChevronDown, ChevronUp, Truck, Weight, Calendar, Package, User, MapPin, ArrowUpDown,
} from "lucide-react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { MonthPicker } from "@/components/MonthPicker";
import { Json } from "@/integrations/supabase/types";

interface MidweighJob {
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
  job_type: string | null;
  category: string | null;
  raw: Json;
}

async function fetchAllPaged(from_date: string, to_date: string) {
  let all: MidweighJob[] = [];
  let from = 0;
  const ps = 1000;
  let more = true;
  while (more) {
    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select("id, job_number, job_date, customer, site, driver, vehicle_registration, waste_description, ewc, container_type, weight_t, movement_type, job_type, category, raw")
      .eq("source", "midweigh")
      .gte("job_date", from_date)
      .lte("job_date", to_date)
      .order("job_date", { ascending: false })
      .range(from, from + ps - 1);
    if (error) throw error;
    if (data) all = all.concat(data as MidweighJob[]);
    more = (data?.length ?? 0) === ps;
    from += ps;
  }
  return all;
}

const MidweighHistory = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(subMonths(now, 1)));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(now));
  const [searchTerm, setSearchTerm] = useState("");
  const [movementFilter, setMovementFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["midweigh-history", startStr, endStr],
    queryFn: () => fetchAllPaged(startStr, endStr),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        (j.job_number ?? "").toLowerCase().includes(term) ||
        (j.customer ?? "").toLowerCase().includes(term) ||
        (j.vehicle_registration ?? "").toLowerCase().includes(term) ||
        (j.waste_description ?? "").toLowerCase().includes(term) ||
        (j.site ?? "").toLowerCase().includes(term) ||
        (j.driver ?? "").toLowerCase().includes(term);
      const matchMovement = movementFilter === "all" || j.movement_type === movementFilter;
      return matchSearch && matchMovement;
    });
  }, [jobs, searchTerm, movementFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const movementTypes = useMemo(() => {
    const types = new Set<string>();
    jobs.forEach((j) => { if (j.movement_type) types.add(j.movement_type); });
    return Array.from(types).sort();
  }, [jobs]);

  const fmtWeight = (wt: number | null) => {
    if (wt == null) return "-";
    return `${(wt / 1000).toFixed(3)} t`;
  };

  const getRawFields = (raw: Json): Record<string, string> => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (val != null && val !== "") {
        result[key] = String(val);
      }
    }
    return result;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job, customer, vehicle, waste..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <MonthPicker selected={startDate} onSelect={setStartDate} mode="start" maxDate={endDate} />
        <span className="text-sm text-muted-foreground">to</span>
        <MonthPicker selected={endDate} onSelect={setEndDate} mode="end" minDate={startDate} maxDate={new Date()} />
        <Select value={movementFilter} onValueChange={setMovementFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Movement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Movements</SelectItem>
            {movementTypes.map((mt) => (
              <SelectItem key={mt} value={mt}>{mt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${filtered.length.toLocaleString()} records`}
        </p>
        {filtered.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => {
              if (expandedIds.size > 0) setExpandedIds(new Set());
              else setExpandedIds(new Set(filtered.slice(0, 50).map((j) => j.id)));
            }}
          >
            <ArrowUpDown className="h-3 w-3" />
            {expandedIds.size > 0 ? "Collapse All" : "Expand First 50"}
          </Button>
        )}
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse h-10 bg-muted/50 rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No Midweigh records found for this period</p>
        </div>
      ) : (
        <div className="space-y-0 border border-border/50 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[100px_90px_1fr_1fr_120px_140px_80px_100px_32px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border/50">
            <span>Job #</span>
            <span>Date</span>
            <span>Customer</span>
            <span>Waste</span>
            <span>Vehicle</span>
            <span>Driver</span>
            <span>Movement</span>
            <span className="text-right">Weight</span>
            <span></span>
          </div>
          {filtered.slice(0, 500).map((job) => {
            const isExpanded = expandedIds.has(job.id);
            const rawFields = isExpanded ? getRawFields(job.raw) : {};

            return (
              <div key={job.id} className="border-b border-border/30 last:border-b-0">
                <div
                  className="grid grid-cols-[100px_90px_1fr_1fr_120px_140px_80px_100px_32px] gap-2 px-3 py-2 items-center text-xs hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(job.id)}
                >
                  <span className="font-mono font-bold text-foreground truncate">{job.job_number}</span>
                  <span className="text-muted-foreground tabular-nums">{job.job_date ? format(parseISO(job.job_date), "dd/MM/yy") : "-"}</span>
                  <span className="text-foreground truncate">{job.customer || "-"}</span>
                  <span className="text-foreground truncate">{job.waste_description || "-"}</span>
                  <span className="font-mono text-foreground truncate">{job.vehicle_registration || "-"}</span>
                  <span className="text-foreground truncate">{job.driver || "-"}</span>
                  <span>
                    {job.movement_type && (
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${
                        job.movement_type === "INWARD"
                          ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                          : "bg-orange-500/10 text-orange-700 border-orange-500/30"
                      }`}>
                        {job.movement_type}
                      </Badge>
                    )}
                  </span>
                  <span className="text-right font-bold tabular-nums text-foreground">{fmtWeight(job.weight_t)}</span>
                  <span className="flex justify-center">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 bg-muted/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                      <Detail label="Job Number" value={job.job_number} />
                      <Detail label="Date" value={job.job_date ? format(parseISO(job.job_date), "dd/MM/yyyy") : null} />
                      <Detail label="Customer" value={job.customer} />
                      <Detail label="Site" value={job.site} />
                      <Detail label="Driver" value={job.driver} />
                      <Detail label="Vehicle" value={job.vehicle_registration} />
                      <Detail label="Waste Description" value={job.waste_description} />
                      <Detail label="EWC Code" value={job.ewc} />
                      <Detail label="Container Type" value={job.container_type} />
                      <Detail label="Weight" value={fmtWeight(job.weight_t)} />
                      <Detail label="Movement" value={job.movement_type} />
                      <Detail label="Job Type" value={job.job_type} />
                      <Detail label="Category" value={job.category} />
                    </div>

                    {/* Raw data */}
                    {Object.keys(rawFields).length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Raw Midweigh Data</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs bg-muted/40 rounded-lg p-3">
                          {Object.entries(rawFields).map(([key, val]) => (
                            <div key={key} className="flex gap-1.5">
                              <span className="text-muted-foreground shrink-0">{key}:</span>
                              <span className="font-medium text-foreground truncate">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > 500 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Showing first 500 of {filtered.length.toLocaleString()} records. Narrow your search or date range.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium text-foreground truncate">{value || "-"}</span>
    </div>
  );
}

export default MidweighHistory;
