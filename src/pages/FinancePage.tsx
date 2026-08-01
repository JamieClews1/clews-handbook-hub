import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PoundSterling } from "lucide-react";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import FinanceDashboard from "@/components/finance/FinanceDashboard";
import InvoicesTab from "@/components/finance/InvoicesTab";
import FinanceSettingsTab from "@/components/finance/FinanceSettingsTab";

export default function FinancePage() {
  const { canAccess, loading } = useFinanceAccess();

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-screen-2xl p-6">
        <h1 className="text-xl font-semibold">Finance</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view finance data. Ask an administrator for the Finance role.
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
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Invoicing, payment tracking and accounts package sync.
          </p>
        </div>
      </header>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="settings">Settings &amp; Sage</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <FinanceDashboard />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <FinanceSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
