import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Mail, Building2, Trash2, Copy, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  file_path: string | null;
  file_name: string | null;
  customerName: string;
  siteName: string | null;
  sentByName: string | null;
  isDuplicate: boolean;
  duplicateCount: number;
  isLatestInGroup: boolean;
};

function periodLabel(start: string) {
  const [y, m] = start.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric" });
}

const gbp = (n: number | null) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

const dupKey = (r: { customer_id: string; site_id: string | null; period_start: string; period_end: string }) =>
  `${r.customer_id}|${r.site_id ?? "_"}|${r.period_start}|${r.period_end}`;

export function SentRebates() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SentRebateRow[]>([]);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SentRebateRow | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: logs, error } = await supabase
        .from("rebate_email_logs")
        .select("id, customer_id, site_id, period_start, period_end, rebate_amount, recipient_email, sent_by, sent_at, file_path, file_name")
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

      const counts = new Map<string, number>();
      (logs ?? []).forEach((l) => {
        const k = dupKey(l);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });

      // logs already sorted by sent_at desc; first occurrence of each key is the latest
      const seenLatest = new Set<string>();
      const enriched: SentRebateRow[] = (logs ?? []).map((l) => {
        const k = dupKey(l);
        const count = counts.get(k) ?? 1;
        let isLatest = false;
        if (!seenLatest.has(k)) {
          seenLatest.add(k);
          isLatest = true;
        }
        return {
          ...l,
          customerName: custMap.get(l.customer_id) ?? "Unknown",
          siteName: l.site_id ? siteMap.get(l.site_id) ?? null : null,
          sentByName: l.sent_by ? userMap.get(l.sent_by) ?? null : null,
          isDuplicate: count > 1,
          duplicateCount: count,
          isLatestInGroup: isLatest,
        };
      });

      setRows(enriched);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load sent rebates.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.period_start));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (periodFilter !== "all" && r.period_start !== periodFilter) return false;
    if (onlyDuplicates && !r.isDuplicate) return false;
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
  const duplicateGroups = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((r) => {
      if (r.isDuplicate) keys.add(dupKey(r));
    });
    return keys.size;
  }, [rows]);
  const olderDuplicates = useMemo(
    () => rows.filter((r) => r.isDuplicate && !r.isLatestInGroup),
    [rows],
  );

  const handleDelete = async (row: SentRebateRow) => {
    setDeleting(row.id);
    try {
      const { error } = await supabase.from("rebate_email_logs").delete().eq("id", row.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Sent rebate log removed." });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      // recompute duplicate flags
      setTimeout(load, 0);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleBulkDeleteOlder = async () => {
    const ids = olderDuplicates.map((r) => r.id);
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("rebate_email_logs").delete().in("id", ids);
      if (error) throw error;
      toast({ title: "Deleted", description: `Removed ${ids.length} older duplicate log${ids.length === 1 ? "" : "s"}.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete.", variant: "destructive" });
    } finally {
      setBulkConfirm(false);
    }
  };

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
          <label className="flex items-center gap-2 text-sm h-10 px-3 rounded-md border bg-background cursor-pointer">
            <Checkbox
              checked={onlyDuplicates}
              onCheckedChange={(v) => setOnlyDuplicates(Boolean(v))}
            />
            Duplicates only
          </label>
          {olderDuplicates.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-10"
              onClick={() => setBulkConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {olderDuplicates.length} older duplicate{olderDuplicates.length === 1 ? "" : "s"}
            </Button>
          )}
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
              <div className="text-sm text-muted-foreground">Duplicate groups</div>
              <div className="text-2xl font-bold mt-1">{duplicateGroups}</div>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.isDuplicate && !r.isLatestInGroup ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.customerName}
                      {r.isDuplicate && (
                        <Badge
                          variant={r.isLatestInGroup ? "secondary" : "destructive"}
                          className="gap-1"
                          title={
                            r.isLatestInGroup
                              ? `Latest of ${r.duplicateCount} sends for this period`
                              : `Older duplicate — ${r.duplicateCount} sends exist for this period`
                          }
                        >
                          <Copy className="h-3 w-3" />
                          {r.isLatestInGroup ? `×${r.duplicateCount}` : "Duplicate"}
                        </Badge>
                      )}
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(r)}
                      disabled={deleting === r.id}
                      title="Delete this sent log"
                    >
                      {deleting === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No sent rebates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sent rebate log?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the audit record for{" "}
              <strong>{confirmDelete?.customerName}</strong>
              {confirmDelete?.siteName ? ` — ${confirmDelete.siteName}` : ""} (
              {confirmDelete ? periodLabel(confirmDelete.period_start) : ""}). The email that was already sent is not
              recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {olderDuplicates.length} older duplicates?</AlertDialogTitle>
            <AlertDialogDescription>
              For every customer/site/period that has multiple sent logs, this keeps the most recent send and deletes
              the older entries. Emails already sent are not recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteOlder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete older duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
