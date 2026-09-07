import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import PayrollWeekDetail from "./PayrollWeekDetail";
import {
  calcGrossPay,
  matchEmployee,
  money,
  num,
  round2,
  type PayrollEmployee,
  type PayrollTimesheet,
} from "@/lib/payroll";

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function PayrollTimesheetsTab() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<PayrollTimesheet | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ["payroll-timesheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_timesheets")
        .select("*")
        .order("week_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayrollTimesheet[];
    },
  });

  const { data: summaries = {} } = useQuery({
    queryKey: ["payroll-timesheet-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_timesheet_entries")
        .select("timesheet_id, total_hours, gross_pay, employee_id");
      if (error) throw error;
      const out: Record<string, { staff: number; hours: number; pay: number; unmatched: number }> = {};
      (data ?? []).forEach((r: any) => {
        const s = (out[r.timesheet_id] ??= { staff: 0, hours: 0, pay: 0, unmatched: 0 });
        s.staff += 1;
        s.hours += num(r.total_hours);
        s.pay += num(r.gross_pay);
        if (!r.employee_id) s.unmatched += 1;
      });
      return out;
    },
  });

  const remove = useMutation({
    mutationFn: async (t: PayrollTimesheet) => {
      if (t.storage_path) await supabase.storage.from("payroll-timesheets").remove([t.storage_path]);
      const { error } = await supabase.from("payroll_timesheets").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-timesheet-summaries"] });
      toast.success("Week removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    setBusy(true);
    const toastId = toast.loading("Reading the timesheet…");
    try {
      const pdfBase64 = await readBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-timesheet-pdf", { body: { pdfBase64 } });
      if (error) throw new Error(await readInvokeError(error));
      if (data?.error) throw new Error(data.error);

      const weekStart: string = data.week_start;
      const weekEnd: string = data.week_end;
      const parsed: any[] = Array.isArray(data.employees) ? data.employees : [];
      if (!weekStart || parsed.length === 0) throw new Error("No staff hours were found in that PDF");

      const path = `${weekStart}/${Date.now()}-${file.name}`;
      await supabase.storage.from("payroll-timesheets").upload(path, file, { contentType: "application/pdf" });

      const { data: userData } = await supabase.auth.getUser();
      const { data: sheet, error: sheetError } = await supabase
        .from("payroll_timesheets")
        .upsert(
          {
            week_start: weekStart,
            week_end: weekEnd || weekStart,
            file_name: file.name,
            storage_path: path,
            status: "review",
            parsed_at: new Date().toISOString(),
            uploaded_by: userData?.user?.id ?? null,
          },
          { onConflict: "week_start" },
        )
        .select()
        .single();
      if (sheetError) throw sheetError;

      const { data: employeesData } = await supabase.from("payroll_employees").select("*");
      const employees = (employeesData ?? []) as unknown as PayrollEmployee[];

      await supabase.from("payroll_timesheet_entries").delete().eq("timesheet_id", sheet.id);

      const rows = parsed.map((p) => {
        const emp = matchEmployee(employees, String(p.employee_name ?? ""), p.employee_no ?? null);
        const base = {
          timesheet_id: sheet.id,
          employee_id: emp?.id ?? null,
          employee_no: p.employee_no ?? emp?.employee_no ?? null,
          employee_name: String(p.employee_name ?? "Unknown"),
          staff_group: emp?.staff_group ?? null,
          week_setup: p.week_setup ?? null,
          days: p.days ?? [],
          rate_totals: p.rate_totals ?? {},
          normal_hours: round2(num(p.normal_hours)),
          higher_rate_hours: round2(num(p.higher_rate_hours)),
          saturday_hours: round2(num(p.saturday_hours)),
          holiday_hours: round2(num(p.holiday_hours)),
          holiday_days: round2(num(p.holiday_days)),
          total_hours: round2(num(p.total_hours)),
          paid_hours: round2(num(p.paid_hours)),
          adjustments: 0,
        };
        return { ...base, gross_pay: calcGrossPay(base as any, emp) };
      });

      const { error: insertError } = await supabase.from("payroll_timesheet_entries").insert(rows);
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["payroll-timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-timesheet-summaries"] });
      toast.success(`Imported ${rows.length} staff for week starting ${weekStart}`, { id: toastId });
      setSelected(sheet as unknown as PayrollTimesheet);
    } catch (err: any) {
      toast.error(err.message || "Could not read that timesheet", { id: toastId });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (selected) {
    return <PayrollWeekDetail timesheet={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Upload the weekly clocking-in PDF — hours are read out and assigned to each staff member.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <Button className="gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {busy ? "Reading…" : "Upload timesheet PDF"}
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading weeks…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week starting</TableHead>
                  <TableHead className="w-28 text-right">Staff</TableHead>
                  <TableHead className="w-32 text-right">Total hours</TableHead>
                  <TableHead className="w-32 text-right">Gross pay</TableHead>
                  <TableHead className="w-32 text-center">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((t) => {
                  const s = summaries[t.id] ?? { staff: 0, hours: 0, pay: 0, unmatched: 0 };
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(t)}
                    >
                      <TableCell className="font-medium">
                        {t.week_start}
                        <span className="ml-2 text-xs text-muted-foreground">{t.file_name}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.staff}
                        {s.unmatched > 0 && (
                          <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">
                            {s.unmatched} unmatched
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{round2(s.hours).toFixed(2)}h</TableCell>
                      <TableCell className="text-right">{money(s.pay)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove.mutate(t);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {timesheets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No timesheets uploaded yet.
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

async function readInvokeError(error: any) {
  try {
    if (error?.context?.text) {
      const body = await error.context.text();
      const parsed = JSON.parse(body);
      return parsed?.error || body;
    }
  } catch {
    /* ignore */
  }
  return error?.message || "Request failed";
}
