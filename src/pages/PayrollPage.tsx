import { PoundSterling } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import PayrollTab from "@/components/finance/payroll/PayrollTab";

export default function PayrollPage() {
  const { canAccess: financeAccess, loading: financeLoading } = useFinanceAccess();
  const { restrictedAllows, loading: sectionsLoading } = usePortalSectionVisibility();
  const loading = financeLoading || sectionsLoading;
  const named = restrictedAllows("payroll");
  const canAccess = named ?? financeAccess;

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-screen-2xl p-6">
        <h1 className="text-xl font-semibold">Payroll &amp; Time</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view payroll data. Ask an administrator to add you in Section Visibility.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-6">
      <PageHeading title="Payroll & Time" description="Timesheets, clocked hours and weekly pay" />

      <PayrollTab />
    </div>
  );
}
