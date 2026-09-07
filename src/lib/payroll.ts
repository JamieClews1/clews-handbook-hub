import * as XLSX from "xlsx";

export type StaffGroup = "yard" | "driver" | "office";

export const STAFF_GROUPS: { value: StaffGroup; label: string }[] = [
  { value: "yard", label: "Yard" },
  { value: "driver", label: "Driver" },
  { value: "office", label: "Office" },
];

export const groupLabel = (g?: string | null) =>
  STAFF_GROUPS.find((s) => s.value === g)?.label ?? "Unassigned";

export const groupBadgeClass = (g?: string | null) => {
  switch (g) {
    case "driver":
      return "bg-primary/10 text-primary border-primary/30";
    case "yard":
      return "bg-amber-500/15 text-amber-700 border-amber-500/40";
    case "office":
      return "bg-sky-500/15 text-sky-700 border-sky-500/40";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export interface PayrollEmployee {
  id: string;
  user_id: string | null;
  employee_no: number | null;
  payroll_no: string | null;
  first_name: string;
  surname: string;
  staff_group: StaffGroup;
  week_setup: string | null;
  basic_rate: number;
  higher_rate: number;
  saturday_rate: number;
  holiday_rate: number;
  weekly_bonus: number;
  contracted_hours: number;
  is_active: boolean;
  notes: string | null;
}

export interface PayrollTimesheet {
  id: string;
  week_start: string;
  week_end: string;
  pay_date: string | null;
  file_name: string | null;
  storage_path: string | null;
  status: string;
  notes: string | null;
  parsed_at: string | null;
  created_at: string;
}

export interface PayrollDay {
  date?: string;
  weekday?: string;
  clockings?: string;
  booked_absence?: string;
  anomalies?: string;
  hours?: number;
}

export interface PayrollEntry {
  id: string;
  timesheet_id: string;
  employee_id: string | null;
  employee_no: number | null;
  employee_name: string;
  staff_group: string | null;
  week_setup: string | null;
  days: PayrollDay[];
  rate_totals: Record<string, number>;
  normal_hours: number;
  higher_rate_hours: number;
  saturday_hours: number;
  holiday_hours: number;
  holiday_days: number;
  total_hours: number;
  paid_hours: number;
  adjustments: number;
  gross_pay: number;
  comments: string | null;
  approved: boolean;
}

/** Weekly gross pay from the entry's hours and the employee's rates. */
export function calcGrossPay(
  entry: Pick<
    PayrollEntry,
    "normal_hours" | "higher_rate_hours" | "saturday_hours" | "holiday_hours" | "adjustments" | "total_hours"
  >,
  employee?: PayrollEmployee | null,
): number {
  if (!employee) return 0;
  const normal = num(entry.normal_hours) * num(employee.basic_rate);
  const higher = num(entry.higher_rate_hours) * num(employee.higher_rate || employee.basic_rate);
  const saturday = num(entry.saturday_hours) * num(employee.saturday_rate || employee.basic_rate);
  const holiday = num(entry.holiday_hours) * num(employee.holiday_rate || employee.basic_rate);
  const bonus =
    num(entry.total_hours) >= num(employee.contracted_hours) ? num(employee.weekly_bonus) : 0;
  return round2(normal + higher + saturday + holiday + bonus + num(entry.adjustments));
}

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num(n));

export const hours = (n: number) => `${round2(num(n)).toFixed(2)}h`;

export const fullName = (e: Pick<PayrollEmployee, "first_name" | "surname">) =>
  `${e.first_name} ${e.surname}`.trim();

/** Match a parsed timesheet name / employee number to the payroll staff list. */
export function matchEmployee(
  employees: PayrollEmployee[],
  name: string,
  employeeNo?: number | null,
): PayrollEmployee | null {
  if (employeeNo != null) {
    const byNo = employees.find((e) => e.employee_no === employeeNo);
    if (byNo) return byNo;
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const target = norm(name);
  const exact = employees.find((e) => norm(fullName(e)) === target);
  if (exact) return exact;
  const parts = target.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    const loose = employees.find(
      (e) => norm(e.surname) === last && norm(e.first_name).startsWith(first.slice(0, 3)),
    );
    if (loose) return loose;
  }
  return null;
}

/** Excel export matching the "Clews Input Sheet" payroll layout. */
export function exportPayrollWorkbook(
  timesheet: PayrollTimesheet,
  entries: PayrollEntry[],
  employees: PayrollEmployee[],
) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const rows = entries.map((entry) => {
    const emp = entry.employee_id ? byId.get(entry.employee_id) : undefined;
    return {
      "Employee Reference": entry.employee_no ?? emp?.employee_no ?? "",
      Surname: emp?.surname ?? entry.employee_name.split(" ").slice(-1)[0] ?? "",
      "First Name": emp?.first_name ?? entry.employee_name.split(" ")[0] ?? "",
      Group: groupLabel(emp?.staff_group ?? entry.staff_group),
      "Normal Hours": round2(entry.normal_hours),
      "Higher Rate Hours": round2(entry.higher_rate_hours),
      "Saturday Higher rate hours": round2(entry.saturday_hours),
      "Basic holiday hours Taken": round2(entry.holiday_hours),
      "No of days holiday": round2(entry.holiday_days),
      "Total Hours": round2(entry.total_hours),
      "Paid Hours": round2(entry.paid_hours),
      "Bonus for complete week": round2(
        emp && entry.total_hours >= num(emp.contracted_hours) ? num(emp.weekly_bonus) : 0,
      ),
      "Adjustments/Deductions": round2(entry.adjustments),
      "Gross Pay": round2(entry.gross_pay),
      Comments: entry.comments ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["CLEWS RECYCLING LTD", "", "Week Starting", timesheet.week_start, "", "Paydate", timesheet.pay_date ?? ""],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
  ws["!cols"] = Object.keys(rows[0] ?? { a: 1 }).map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Clews Input Sheet");


  const dayRows: Record<string, string | number>[] = [];
  entries.forEach((entry) => {
    (entry.days ?? []).forEach((d) => {
      dayRows.push({
        Employee: entry.employee_name,
        "Employee No": entry.employee_no ?? "",
        Date: d.date ?? "",
        Day: d.weekday ?? "",
        Clockings: d.clockings ?? "",
        "Booked absence": d.booked_absence ?? "",
        Anomalies: d.anomalies ?? "",
        Hours: round2(num(d.hours)),
      });
    });
  });
  if (dayRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), "Daily Clockings");
  }

  XLSX.writeFile(wb, `payroll_week_${timesheet.week_start}.xlsx`);
}
