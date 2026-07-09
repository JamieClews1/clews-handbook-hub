import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Mail, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type SentRebateRow = {
  id: string;
  customer_id: string;
  site_id: string | null;
  period_start: string;
  period_end: string;
  rebate_amount: number | null;
  recipient_email: string | null;
  sent_by: string | null;
  sent_at: string | null;
  customerName: string;
  siteName: string | null;
  sentByName: string | null;
};

function periodLabel(start: string) {
  const [y, m] = start.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric" });
}

const gbp = (n: number | null) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function SentRebates() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SentRebateRow[]>([]);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from("rebate_email_logs")
          .select("id, customer_id, site_id, period_start, period_end, rebate_amount, recipient_email, sent_by, sent_at")
          .order("sent_at", { ascending: false });
        if (error) throw error;

        const customerIds = new Set<string>();
        const siteIds = new Set<string>();
        const userIds = new Set<string>();
        (logs ?? []).forEach((l) => {
          if (l.customer_id) customerIds.add(l.customer_id);
          if (l.site_id) siteIds.add(l.site_id);
          if (l.sent_by) userIds.add(l.sent_by);
        });

        const [{ data: customers }, { data: sites }, { data: profiles }] = await Promise.all([
          customerIds.size
            ? supabase.from("customers").select("id, customer_name").in("id", Array.from(customerIds))
            : Promise.resolve({ data: [] as any[] }),
          siteIds.size
            ? supabase.from("customer_sites").select("id, site_name").in("id", Array.from(siteIds))
            : Promise.resolve({ data: [] as any[] }),
          userIds.size
            ? supabase.from("profiles").select("id, full_name, email").in("id", Array.from(userIds))
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const custMap = new Map((customers ?? []).map((c: any) => [c.id, c.customer_name]));
        const siteMap = new Map((sites ?? []).map((s: any) => [s.id, s.site_name]));
        const userMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));

        setRows(
          (logs ?? []).map((l) => ({
            ...l,
            customerName: custMap.get(l.customer_id) ?? "Unknown",
            siteName: l.site_id ? siteMap.get(l.site_id) ?? null : null,
            sentByName: l.sent_by ? userMap.get(l.sent_by) ?? null : null,
          })),
        );
      } catch (e: any) {
        toast({ title: "Error", description: e?.message ?? "Failed to load sent rebates.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const periodOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.period_start));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (periodFilter !== "all" && r.period_start !== periodFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.customerName.toLowerCase().includes(q) &&
        !(r.siteName ?? "").toLowerCase().includes(q) &&
        !(r.recipient_email ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((sum, r) => sum + (r.rebate_amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative w-[260px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search customer, site or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periodOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {periodLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Emails sent</div>
              <div className="text-2xl font-bold mt-1">{filtered.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total rebate</div>
              <div className="text-2xl font-bold mt-1">{gbp(totalAmount)}</div>
            </CardContent>
          </Card>
        </div>
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
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Rebate</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Sent by</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.customerName}
                    </span>
                  </TableCell>
                  <TableCell>{r.siteName ?? "—"}</TableCell>
                  <TableCell>{periodLabel(r.period_start)}</TableCell>
                  <TableCell className="text-right font-medium">{gbp(r.rebate_amount)}</TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.recipient_email ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.sentByName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.sent_at ? format(new Date(r.sent_at), "d MMM yyyy HH:mm") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No sent rebates found.
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
