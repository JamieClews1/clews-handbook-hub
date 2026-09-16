import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { formatUkDate, permitDisplayState, type PermitApplication } from "@/lib/permits";
import { usePermitApplications, usePermitSettings } from "@/hooks/usePermits";
import { PermitDialog } from "./PermitDialog";

export function PermitApplicationsTab() {
  const { data: permits = [], isLoading } = usePermitApplications();
  const { data: settings } = usePermitSettings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<PermitApplication | null>(null);
  const [open, setOpen] = useState(false);

  const lead = settings?.chase_lead_hours ?? 72;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permits.filter((p) => {
      const state = permitDisplayState(p, lead);
      if (statusFilter !== "all" && state.key !== statusFilter) return false;
      if (!q) return true;
      return [p.job_number, p.customer_name, p.site_address, p.site_postcode, p.area, p.permit_reference]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [permits, search, statusFilter, lead]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search job, customer, postcode or permit reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="needed">Permit needed</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> New permit
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="w-[110px]">Postcode</TableHead>
                <TableHead>Council</TableHead>
                <TableHead className="hidden lg:table-cell">Notice</TableHead>
                <TableHead className="w-[100px]">Price</TableHead>
                <TableHead className="w-[110px]">Start</TableHead>
                <TableHead className="w-[110px]">Expires</TableHead>
                <TableHead className="w-[120px]">Reference</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const state = permitDisplayState(p, lead);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setEditing(p); setOpen(true); }}
                  >
                    <TableCell className="tabular-nums text-sm font-medium">{p.job_number || "—"}</TableCell>
                    <TableCell className="text-sm">{p.customer_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">{p.site_address || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{p.site_postcode || "—"}</TableCell>
                    <TableCell className="text-sm">{p.area || <span className="text-warning">No rate</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.notice_required || "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {p.price_exc_vat != null ? `£${Number(p.price_exc_vat).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{formatUkDate(p.start_date) || "—"}</TableCell>
                    <TableCell className="text-sm">{formatUkDate(p.expiry_date) || "—"}</TableCell>
                    <TableCell className="text-sm">{p.permit_reference || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${state.className}`}>{state.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    No permits yet — add one with “New permit”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PermitDialog open={open} onOpenChange={setOpen} permit={editing} />
    </div>
  );
}
