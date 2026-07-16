import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Mail, Building2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchTrackingForPeriod,
  upsertTracking,
  trackingKey,
  STATUS_META,
  type RebateTrackingRow,
  type RebateTrackingStatus,
} from "@/lib/rebate-tracking";

type ConfiguredSite = {
  siteId: string;
  siteName: string;
  customerId: string;
  customerName: string;
};

function monthStartISO(d: Date) {
  return format(startOfMonth(d), "yyyy-MM-dd");
}
function labelForMonth(monthStart: string) {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function RebateReportTracking() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [monthStart, setMonthStart] = useState(() => monthStartISO(new Date()));
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<ConfiguredSite[]>([]);
  const [tracking, setTracking] = useState<Map<string, RebateTrackingRow>>(new Map());
  const [amounts, setAmounts] = useState<Map<string, number>>(new Map());
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | RebateTrackingStatus>("all");
  const [search, setSearch] = useState("");

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      options.push(monthStartISO(d));
    }
    return options;
  }, []);

  const periodStart = monthStart;
  const periodEnd = format(endOfMonth(new Date(monthStart)), "yyyy-MM-dd");

  const load = async () => {
    setLoading(true);
    try {
      // Sites that have any rebate configuration (price set or skip/roro rebate)
      const [{ data: priceSets }, { data: skipRebates }] = await Promise.all([
        supabase.from("customer_site_price_sets").select("site_id"),
        supabase.from("customer_site_skip_rebates").select("site_id"),
      ]);
      const configuredSiteIds = new Set<string>();
      (priceSets ?? []).forEach((r) => r.site_id && configuredSiteIds.add(r.site_id));
      (skipRebates ?? []).forEach((r) => r.site_id && configuredSiteIds.add(r.site_id));

      let configured: ConfiguredSite[] = [];
      if (configuredSiteIds.size > 0) {
        const { data: siteRows } = await supabase
          .from("customer_sites")
          .select("id, site_name, customer_id, customers!inner(customer_name)")
          .in("id", Array.from(configuredSiteIds));
        configured = (siteRows ?? []).map((s: any) => ({
          siteId: s.id,
          siteName: s.site_name,
          customerId: s.customer_id,
          customerName: s.customers?.customer_name ?? "",
        }));
        configured.sort((a, b) => a.customerName.localeCompare(b.customerName) || a.siteName.localeCompare(b.siteName));
      }
      setSites(configured);

      const trackingMap = await fetchTrackingForPeriod(periodStart, periodEnd);
      setTracking(trackingMap);

      // Resolve user display names
      const userIds = new Set<string>();
      trackingMap.forEach((r) => {
        if (r.generated_by) userIds.add(r.generated_by);
        if (r.sent_by) userIds.add(r.sent_by);
      });
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(userIds));
        const names: Record<string, string> = {};
        (profiles ?? []).forEach((p) => (names[p.id] = p.full_name || p.email || "Unknown"));
        setUserNames(names);
      } else {
        setUserNames({});
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load tracking.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart]);

  const rowStatus = (s: ConfiguredSite): RebateTrackingStatus =>
    (tracking.get(trackingKey(s.customerId, s.siteId))?.status ?? "not_generated");

  const markSent = async (s: ConfiguredSite) => {
    await upsertTracking({
      customerId: s.customerId,
      siteId: s.siteId,
      periodStart,
      periodEnd,
      status: "sent",
      userId: user?.id,
    });
    toast({ title: "Marked sent", description: `${s.customerName} — ${s.siteName}` });
    await load();
  };

  const filtered = sites.filter((s) => {
    const status = rowStatus(s);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.customerName.toLowerCase().includes(q) && !s.siteName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = sites.reduce(
    (acc, s) => {
      acc[rowStatus(s)] += 1;
      return acc;
    },
    { not_generated: 0, generated: 0, sent: 0 } as Record<RebateTrackingStatus, number>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[220px]">
            <Select value={monthStart} onValueChange={setMonthStart}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {labelForMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search customer or site" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="not_generated">Not generated</SelectItem>
              <SelectItem value="generated">Generated (unsent)</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Configured sites" value={sites.length} dot="bg-foreground" />
        <StatCard label={STATUS_META.sent.label} value={counts.sent} dot={STATUS_META.sent.dot} />
        <StatCard label={STATUS_META.generated.label} value={counts.generated} dot={STATUS_META.generated.dot} />
        <StatCard label={STATUS_META.not_generated.label} value={counts.not_generated} dot={STATUS_META.not_generated.dot} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated by</TableHead>
                <TableHead>Sent by</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const row = tracking.get(trackingKey(s.customerId, s.siteId));
                const status = rowStatus(s);
                const meta = STATUS_META[status];
                return (
                  <TableRow key={s.siteId} className={cn("border-l-4", meta.border)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.customerName}
                      </span>
                    </TableCell>
                    <TableCell>{s.siteName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", meta.badge)}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row?.generated_at ? (
                        <>
                          {row.generated_by ? userNames[row.generated_by] ?? "—" : "—"}
                          <div className="text-xs">{format(new Date(row.generated_at), "d MMM HH:mm")}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row?.sent_at ? (
                        <>
                          {row.sent_by ? userNames[row.sent_by] ?? "—" : "—"}
                          <div className="text-xs">{format(new Date(row.sent_at), "d MMM HH:mm")}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row?.recipient_email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {status !== "sent" && (
                        <Button variant="outline" size="sm" onClick={() => markSent(s)}>
                          <Mail className="h-3.5 w-3.5 mr-1.5" />
                          Mark sent
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No configured sites match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
          {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
