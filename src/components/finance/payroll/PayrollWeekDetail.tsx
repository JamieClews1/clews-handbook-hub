import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Download, Lock, LockOpen, TriangleAlert } from "lucide-react";
import {
  STAFF_GROUPS,
  calcGrossPay,
  exportPayrollWorkbook,
  fullName,
  groupBadgeClass,
  groupLabel,
  hours,
  matchEmployee,
  money,
  num,
  round2,
  type PayrollEmployee,
  type PayrollEntry,
  type PayrollTimesheet,
} from "@/lib/payroll";

interface Props {
  timesheet: PayrollTimesheet;
  onBack: () => void;
}

export default function PayrollWeekDetail({ timesheet, onBack }: Props) {
  const queryClient = useQueryClient();
  const [groupFilter, setGroupFilter] = useState("all");
  const locked = timesheet.status === "approved";

  const { data: employees = [] } = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_employees").select("*").order("surname");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollEmployee[];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["payroll-entries", timesheet.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_timesheet_entries")
        .select("*")
        .eq("timesheet_id", timesheet.id)
        .order("employee_name");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollEntry[];
    },
  });

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const updateEntry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("payroll_timesheet_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-entries", timesheet.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("payroll_timesheets").update({ status }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-timesheets"] });
      toast.success("Week updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const patchWithPay = (entry: PayrollEntry, patch: Record<string, unknown>) => {
    const merged = { ...entry, ...patch } as PayrollEntry;
    const emp = merged.employee_id ? empById.get(merged.employee_id) : null;
    updateEntry.mutate({ id: entry.id, patch: { ...patch, gross_pay: calcGrossPay(merged, emp) } });
  };

  const autoAssign = useMutation({
    mutationFn: async () => {
      const unassigned = entries.filter((e) => !e.employee_id);
      let matched = 0;
      for (const entry of unassigned) {
        const emp = matchEmployee(employees, entry.employee_name, entry.employee_no);
        if (!emp) continue;
        matched++;
        const { error } = await supabase
          .from("payroll_timesheet_entries")
          .update({
            employee_id: emp.id,
            staff_group: emp.staff_group,
            gross_pay: calcGrossPay(entry, emp),
          })
          .eq("id", entry.id);
        if (error) throw error;
      }
      return matched;
    },
    onSuccess: (matched) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-entries", timesheet.id] });
      toast.success(matched ? `Matched ${matched} staff member(s)` : "No new matches found");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recalcAll = useMutation({
    mutationFn: async () => {
      for (const entry of entries) {
        const emp = entry.employee_id ? empById.get(entry.employee_id) : null;
        const gross = calcGrossPay(entry, emp);
        if (round2(num(entry.gross_pay)) === gross) continue;
        const { error } = await supabase
          .from("payroll_timesheet_entries")
          .update({ gross_pay: gross })
          .eq("id", entry.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-entries", timesheet.id] });
      toast.success("Pay recalculated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (groupFilter === "all") return entries;
    if (groupFilter === "unassigned") return entries.filter((e) => !e.employee_id);
    return entries.filter((e) => (e.employee_id ? empById.get(e.employee_id)?.staff_group : null) === groupFilter);
  }, [entries, groupFilter, empById]);

  const totals = useMemo(
    () => ({
      staff: entries.length,
      unassigned: entries.filter((e) => !e.employee_id).length,
      hours: round2(entries.reduce((s, e) => s + num(e.total_hours), 0)),
      pay: round2(entries.reduce((s, e) => s + num(e.gross_pay), 0)),
    }),
    [entries],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> All weeks
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => autoAssign.mutate()} disabled={locked}>
            Auto-match staff
          </Button>
          <Button size="sm" variant="outline" onClick={() => recalcAll.mutate()} disabled={locked}>
            Recalculate pay
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => exportPayrollWorkbook(timesheet, entries, employees)}
          >
            <Download className="h-3.5 w-3.5" /> Export payroll sheet
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setStatus.mutate(locked ? "review" : "approved")}
          >
            {locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {locked ? "Re-open week" : "Approve week"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Week starting {timesheet.week_start}
            {timesheet.pay_date ? ` · pay date ${timesheet.pay_date}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Staff" value={String(totals.staff)} />
          <Stat label="Total hours" value={hours(totals.hours)} />
          <Stat label="Gross pay" value={money(totals.pay)} />
          <Stat
            label="Unmatched"
            value={String(totals.unassigned)}
            warn={totals.unassigned > 0}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {STAFF_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Unmatched only</SelectItem>
          </SelectContent>
        </Select>
        {locked && <Badge variant="outline">Week approved — read only</Badge>}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading hours…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name on timesheet</TableHead>
                  <TableHead className="w-56">Staff member</TableHead>
                  <TableHead className="w-24">Group</TableHead>
                  <TableHead className="w-24 text-right">Normal</TableHead>
                  <TableHead className="w-24 text-right">Higher</TableHead>
                  <TableHead className="w-24 text-right">Saturday</TableHead>
                  <TableHead className="w-24 text-right">Holiday</TableHead>
                  <TableHead className="w-24 text-right">Total</TableHead>
                  <TableHead className="w-28 text-right">Adjust £</TableHead>
                  <TableHead className="w-28 text-right">Gross pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    employees={employees}
                    employee={entry.employee_id ? empById.get(entry.employee_id) ?? null : null}
                    locked={locked}
                    onPatch={(patch) => patchWithPay(entry, patch)}
                  />
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      No hours recorded for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${warn ? "text-destructive" : ""}`}>
        {warn && <TriangleAlert className="mr-1 inline h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}

function EntryRow({
  entry,
  employees,
  employee,
  locked,
  onPatch,
}: {
  entry: PayrollEntry;
  employees: PayrollEmployee[];
  employee: PayrollEmployee | null;
  locked: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [openDays, setOpenDays] = useState(false);

  const numberCell = (key: keyof PayrollEntry) => (
    <TableCell className="text-right">
      <Input
        className="h-8 text-right"
        inputMode="decimal"
        disabled={locked}
        defaultValue={String(round2(num(entry[key] as number)))}
        onBlur={(e) => {
          const v = round2(Number(e.target.value) || 0);
          if (v !== round2(num(entry[key] as number))) onPatch({ [key]: v });
        }}
      />
    </TableCell>
  );

  return (
    <>
      <TableRow className={entry.employee_id ? "" : "bg-destructive/5"}>
        <TableCell>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpenDays((v) => !v)}>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDays ? "rotate-180" : ""}`} />
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          {entry.employee_name}
          {entry.employee_no != null && (
            <span className="ml-1 font-mono text-xs text-muted-foreground">#{entry.employee_no}</span>
          )}
        </TableCell>
        <TableCell>
          <Select
            value={entry.employee_id ?? "none"}
            disabled={locked}
            onValueChange={(v) => {
              const emp = employees.find((e) => e.id === v) ?? null;
              onPatch({ employee_id: emp?.id ?? null, staff_group: emp?.staff_group ?? null });
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Not matched" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not matched</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {fullName(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={groupBadgeClass(employee?.staff_group)}>
            {groupLabel(employee?.staff_group)}
          </Badge>
        </TableCell>
        {numberCell("normal_hours")}
        {numberCell("higher_rate_hours")}
        {numberCell("saturday_hours")}
        {numberCell("holiday_hours")}
        <TableCell className="text-right font-medium">{hours(entry.total_hours)}</TableCell>
        {numberCell("adjustments")}
        <TableCell className="text-right font-semibold">{money(entry.gross_pay)}</TableCell>
      </TableRow>
      {openDays && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/40">
            <div className="grid gap-2 p-2 sm:grid-cols-4 lg:grid-cols-7">
              {(entry.days ?? []).map((d, i) => (
                <div key={i} className="rounded-md border bg-background p-2 text-xs">
                  <p className="font-medium">{d.weekday || d.date}</p>
                  <p className="text-muted-foreground">{d.date}</p>
                  <p className="mt-1">{d.clockings || "—"}</p>
                  {d.booked_absence && <p className="text-primary">{d.booked_absence}</p>}
                  {d.anomalies && <p className="text-destructive">{d.anomalies}</p>}
                  <p className="mt-1 font-semibold">{hours(num(d.hours))}</p>
                </div>
              ))}
              {(entry.days ?? []).length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">No daily breakdown captured.</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
