import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import CompanyProfitLossTab from "@/components/finance/CompanyProfitLossTab";
import CompanyPerformanceDashboard from "@/components/finance/CompanyPerformanceDashboard";
import CompanyPlSettingsTab, { PL_SOURCE_STORAGE_KEY, readPlSourcePreference } from "@/components/finance/CompanyPlSettingsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlSheetName } from "@/lib/company-pl";

export default function CompanyProfitLossPage() {
  const { canAccess, loading } = useFinanceAccess();
  const { canAccessPl, loading: plLoading } = useCompanyPlAccess();
  const [source, setSource] = useState<PlSheetName>(readPlSourcePreference);

  const changeSource = (value: PlSheetName) => {
    setSource(value);
    try { localStorage.setItem(PL_SOURCE_STORAGE_KEY, value); } catch { /* preference is best-effort */ }
  };

  if (loading || plLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!canAccess || !canAccessPl) {
    return (
      <div className="mx-auto max-w-screen-2xl p-6">
        <h1 className="text-xl font-semibold">Company P&L</h1>
        <p className="mt-2 flex items-center gap-2 text-muted-foreground">
          <LockKeyhole className="h-4 w-4" /> You do not have permission to view company P&L data.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Company P&L</h1>
        <p className="text-sm text-muted-foreground">
          Private company profit & loss workbooks. Only you can see this section.
        </p>
      </header>
      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="source">Source worksheets</TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="mt-4"><CompanyPerformanceDashboard /></TabsContent>
        <TabsContent value="source" className="mt-4"><CompanyProfitLossTab /></TabsContent>
      </Tabs>
    </div>
  );
}
