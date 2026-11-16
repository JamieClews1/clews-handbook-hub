import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportingYearLabel } from "@/lib/colas-report";
import { useColasSettings, useColasYear } from "@/components/colas/useColasData";
import { ColasDashboard } from "@/components/colas/ColasDashboard";
import { ColasReports } from "@/components/colas/ColasReports";
import { ColasHazardous } from "@/components/colas/ColasHazardous";
import { ColasCollections } from "@/components/colas/ColasCollections";
import { ColasCosts } from "@/components/colas/ColasCosts";
import { ColasSettings } from "@/components/colas/ColasSettings";

export const COLAS_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Monthly reports" },
  { key: "hazardous", label: "Hazardous (Robert Hopkins)" },
  { key: "collections", label: "Enva, B&M & Fortress" },
  { key: "costs", label: "Costs (Sage)" },
  { key: "settings", label: "Sources & settings" },
] as const;

export default function ColasRailPage() {
  const { tab = "dashboard" } = useParams();
  const navigate = useNavigate();
  const settings = useColasSettings();
  const startMonth = settings.data?.year_start_month;
  const now = new Date();
  const currentYear = startMonth && now.getMonth() + 1 < startMonth ? now.getFullYear() - 1 : now.getFullYear();
  const [year, setYear] = useState(currentYear);
  useEffect(() => { setYear(currentYear); }, [currentYear]);
  const q = useColasYear(year, startMonth);
  const data = q.data;
  const defaultIndex = useMemo(() => {
    if (!data) return 0;
    const i = data.months.findIndex(m => m.inProgress);
    return i === -1 ? 11 : Math.max(0, i);
  }, [data]);
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [reportIndex, setReportIndex] = useState<number | null>(null);
  const idx = monthIndex ?? defaultIndex;
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-screen-2xl space-y-6 px-4 py-8">
        <PageHeading title="Colas Rail" description="Waste & cost reporting"
          actions={<>
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setMonthIndex(null); setReportIndex(null); }}>
              <SelectTrigger className="w-36" aria-label="Reporting year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{reportingYearLabel(y, startMonth ?? 1)}</SelectItem>)}</SelectContent>
            </Select>
            {tab === "dashboard" && data && (
              <Select value={String(idx)} onValueChange={(v) => setMonthIndex(Number(v))}>
                <SelectTrigger className="w-44" aria-label="Reporting month"><SelectValue /></SelectTrigger>
                <SelectContent>{data.months.map((m, i) => <SelectItem key={m.label} value={String(i)}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </>} />
        <Tabs value={tab} onValueChange={(v) => navigate(v === "dashboard" ? "/colas-rail" : `/colas-rail/${v}`)}>
          <TabsList className="h-auto flex-wrap">{COLAS_TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        {q.isLoading || settings.isLoading ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading Colas Rail records…</div>
        ) : q.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            Could not load the Colas Rail records: {(q.error as Error).message}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => q.refetch()}>Try again</Button>
          </div>
        ) : data && settings.data ? (
          <>
            {tab === "dashboard" && <ColasDashboard data={data} index={idx} />}
            {tab === "reports" && <ColasReports data={data} selected={reportIndex} onSelect={setReportIndex} />}
            {tab === "hazardous" && <ColasHazardous data={data} />}
            {tab === "collections" && <ColasCollections data={data} />}
            {tab === "costs" && <ColasCosts data={data} />}
            {tab === "settings" && <ColasSettings data={data} settings={settings.data} />}
          </>
        ) : null}
      </main>
    </div>
  );
}
