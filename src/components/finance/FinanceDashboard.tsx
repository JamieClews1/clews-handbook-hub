import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, Loader2, PoundSterling, TrendingUp } from "lucide-react";
import {
  daysOverdue,
  fmtDate,
  money,
  STATUS_LABEL,
  statusBadgeClass,
  type Invoice,
} from "@/lib/finance";
import InvoiceDetailDialog from "./InvoiceDetailDialog";

const Kpi = ({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone?: "danger";
}) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-5">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

export function FinanceDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: cust }] = await Promise.all([
      supabase.from("invoices").select("*").neq("status", "cancelled").order("due_date"),
      supabase.from("customers").select("id, customer_name"),
    ]);
    setInvoices((inv ?? []) as unknown as Invoice[]);
    setNames(Object.fromEntries((cust ?? []).map((c: any) => [c.id, c.customer_name])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const { outstanding, overdue, totalOwed, recentlyPaid, overdueTotal } = useMemo(() => {
    const live = invoices.filter((i) => i.status !== "paid" && i.status !== "draft");
    const od = live
      .filter((i) => daysOverdue(i) > 0)
      .sort((a, b) => daysOverdue(b) - daysOverdue(a));
    const owed = live.reduce((s, i) => s + (Number(i.gross_total) - Number(i.amount_paid)), 0);
    const paid = invoices
      .filter((i) => i.status === "paid")
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10);
    return {
      outstanding: live,
      overdue: od,
      totalOwed: owed,
      recentlyPaid: paid,
      overdueTotal: od.reduce((s, i) => s + (Number(i.gross_total) - Number(i.amount_paid)), 0),
    };
  }, [invoices]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading finance data…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Total owed" value={money(totalOwed)} icon={PoundSterling} sub={`${outstanding.length} open invoices`} />
        <Kpi
          label="Overdue"
          value={money(overdueTotal)}
          icon={AlertTriangle}
          tone="danger"
          sub={`${overdue.length} invoices past due`}
        />
        <Kpi
          label="Due next 30 days"
          value={money(
            outstanding
              .filter((i) => daysOverdue(i) === 0)
              .reduce((s, i) => s + (Number(i.gross_total) - Number(i.amount_paid)), 0),
          )}
          icon={Clock}
        />
        <Kpi
          label="Paid (last 10)"
          value={money(recentlyPaid.reduce((s, i) => s + Number(i.gross_total), 0))}
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overdue invoices</CardTitle>
          <CardDescription>Oldest first — click a row to chase or record payment.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {overdue.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing overdue. </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Days overdue</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdue.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i.id)}>
                    <TableCell className="font-medium">{i.invoice_number}</TableCell>
                    <TableCell>{names[i.customer_id] ?? "—"}</TableCell>
                    <TableCell>{fmtDate(i.due_date)}</TableCell>
                    <TableCell className="text-right text-destructive">{daysOverdue(i)}</TableCell>
                    <TableCell className="text-right">
                      {money(Number(i.gross_total) - Number(i.amount_paid), i.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(i.status)}>
                        {STATUS_LABEL[i.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recently paid</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentlyPaid.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentlyPaid.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i.id)}>
                    <TableCell className="font-medium">{i.invoice_number}</TableCell>
                    <TableCell>{names[i.customer_id] ?? "—"}</TableCell>
                    <TableCell>{fmtDate(i.issue_date)}</TableCell>
                    <TableCell className="text-right">{money(i.gross_total, i.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailDialog
        invoiceId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}

export default FinanceDashboard;
