import { PoundSterling } from "lucide-react";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import PayrollTab from "@/components/finance/payroll/PayrollTab";

export default function PayrollPage() {
  const { canAccess, loading } = useFinanceAccess();

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-screen-2xl p-6">
        <h1 className="text-xl font-semibold">Payroll &amp; Time</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view payroll data. Ask an administrator for the Finance role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PoundSterling className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll &amp; Time</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded timesheets, clocked hours and weekly pay for Yard, Driver and Office staff.
          </p>
        </div>
      </header>

      <PayrollTab />
    </div>
  );
}
