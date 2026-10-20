import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import type { TradingEvidence } from "@/lib/company-pl-trading";
import { Loader2, LockKeyhole } from "lucide-react";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import CompanyProfitLossTab from "@/components/finance/CompanyProfitLossTab";
import CompanyPerformanceDashboard from "@/components/finance/CompanyPerformanceDashboard";
import CompanyPlSettingsTab, { PL_SOURCE_STORAGE_KEY, PL_METHOD_STORAGE_KEY, readPlSourcePreference, readPlMethodPreference } from "@/components/finance/CompanyPlSettingsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlSheetName } from "@/lib/company-pl";
import type { PlProjectionMethod } from "@/lib/company-pl-analysis";

export default function CompanyProfitLossPage() {
  const { canAccess, loading } = useFinanceAccess();
  const { canAccessPl, loading: plLoading } = useCompanyPlAccess();
  const [source, setSource] = useState<PlSheetName>(readPlSourcePreference);
  const [method, setMethod] = useState<PlProjectionMethod>(readPlMethodPreference);
  const [trading, setTrading] = useState<TradingEvidence | null>(null);
  const [tradingError, setTradingError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [useTrading, setUseTrading] = useState(() => { try { return localStorage.getItem("company-pl-trading") === "true"; } catch { return false; } });
  useEffect(() => {
    if (!canAccess || !canAccessPl) return;
    let active = true;
    setTradingError(false);
    withTimeout(supabase.rpc("get_company_pl_operational_trends"), 25000, "Trading trends").then(({ data, error }) => {
      if (!active) return;
      if (error) { setTrading(null); setTradingError(true); } else setTrading(data as unknown as TradingEvidence);
    }).catch(() => { if (active) { setTrading(null); setTradingError(true); } });
    return () => { active = false; };
  }, [canAccess, canAccessPl, retry]);
  const changeTrading = (value: boolean) => { setUseTrading(value); try { localStorage.setItem("company-pl-trading", String(value)); } catch { /* best effort */ } };

  const changeSource = (value: PlSheetName) => {
    setSource(value);
    try { localStorage.setItem(PL_SOURCE_STORAGE_KEY, value); } catch { /* preference is best-effort */ }
  };

  const changeMethod = (value: PlProjectionMethod) => {
    setMethod(value);
    try { localStorage.setItem(PL_METHOD_STORAGE_KEY, value); } catch { /* preference is best-effort */ }
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
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="mt-4"><CompanyPerformanceDashboard source={source} method={method} onMethodChange={changeMethod} trading={trading} useTrading={useTrading} /></TabsContent>
        <TabsContent value="source" className="mt-4"><CompanyProfitLossTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><CompanyPlSettingsTab value={source} onChange={changeSource} method={method} onMethodChange={changeMethod} trading={trading} tradingError={tradingError} retry={() => setRetry((v) => v + 1)} useTrading={useTrading} onTradingChange={changeTrading} /></TabsContent>
      </Tabs>
    </div>
  );
}
