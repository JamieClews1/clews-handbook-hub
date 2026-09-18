import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Container, Warehouse, MapPin, Calendar, Download } from "lucide-react";
import { format } from "date-fns";
import { useExpectedStock, type ExpectedContainerType } from "@/hooks/useExpectedStock";

export const StockCheckTotalStock = () => {
  const {
    loading,
    containerTypes,
    inYardByType,
    onSiteByType,
    onSiteOther,
    siteDetail,
    latestCheckDate,
  } = useExpectedStock();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (containerTypes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No container types configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  const skips = containerTypes.filter((t) => t.category === "skip");
  const roros = containerTypes.filter((t) => t.category === "roro");

  const sumFor = (types: ExpectedContainerType[], src: Record<string, number>) =>
    types.reduce((acc, t) => acc + (src[t.id] || 0), 0);

  const skipYard = sumFor(skips, inYardByType);
  const skipSite = sumFor(skips, onSiteByType) + onSiteOther.skip;
  const roroYard = sumFor(roros, inYardByType);
  const roroSite = sumFor(roros, onSiteByType) + onSiteOther.roro;

  const downloadSiteReport = () => {
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "");
    const header = [
      "Site",
      "Customer",
      "Category",
      "Type",
      "Container (raw)",
      "Waste / EWC",
      "On Site",
      "Last On-Site Movement",
      "Last Collection",
    ];
    const lines = [header.map(esc).join(",")];
    for (const r of siteDetail) {
      lines.push(
        [
          r.site,
          r.customer ?? "",
          r.category === "skip" ? "Skip" : "RoRo",
          r.typeName,
          r.containerType,
          r.ewc,
          r.count,
          fmt(r.lastKeepDate),
          fmt(r.lastCollectionDate),
        ]
          .map(esc)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `total-stock-site-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Total Stock</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Total fleet owned by type — what is out on site plus what is In Yard from the Current Stock Overview.
            On-site counts use the same categorisation as Live Jobs.
          </p>
          {latestCheckDate && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" />
              Based on last check: {format(new Date(latestCheckDate), "dd MMM yyyy 'at' HH:mm")}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={downloadSiteReport}
          disabled={siteDetail.length === 0}
        >
          <Download className="h-4 w-4" />
          Download site report
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-5 w-5 text-primary" />
              Total Skips Owned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{skipYard + skipSite}</div>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" /> {skipYard} In Yard</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {skipSite} On Site</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Container className="h-5 w-5 text-primary" />
              Total RoRos Owned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{roroYard + roroSite}</div>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" /> {roroYard} In Yard</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {roroSite} On Site</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By type breakdown */}
      <TotalStockTable title="Skips" icon={<Truck className="h-5 w-5 text-primary" />} types={skips} inYard={inYardByType} onSite={onSiteByType} otherOnSite={onSiteOther.skip} />
      <TotalStockTable title="RoRos" icon={<Container className="h-5 w-5 text-primary" />} types={roros} inYard={inYardByType} onSite={onSiteByType} otherOnSite={onSiteOther.roro} />
    </div>
  );
};

const TotalStockTable = ({
  title,
  icon,
  types,
  inYard,
  onSite,
  otherOnSite,
}: {
  title: string;
  icon: React.ReactNode;
  types: ExpectedContainerType[];
  inYard: Record<string, number>;
  onSite: Record<string, number>;
  otherOnSite: number;
}) => {
  if (types.length === 0) return null;
  const totalYard = types.reduce((a, t) => a + (inYard[t.id] || 0), 0);
  const totalSite = types.reduce((a, t) => a + (onSite[t.id] || 0), 0) + otherOnSite;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left font-medium py-2 px-3">Type</th>
              <th className="text-right font-medium py-2 px-3">In Yard</th>
              <th className="text-right font-medium py-2 px-3">On Site</th>
              <th className="text-right font-medium py-2 px-3">Total Owned</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const yard = inYard[t.id] || 0;
              const site = onSite[t.id] || 0;
              return (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-foreground">{t.name}</td>
                  <td className="py-2 px-3 text-right">{yard}</td>
                  <td className="py-2 px-3 text-right">{site}</td>
                  <td className="py-2 px-3 text-right font-bold text-foreground">{yard + site}</td>
                </tr>
              );
            })}
            {otherOnSite > 0 && (
              <tr className="border-b border-border/50">
                <td className="py-2 px-3 font-medium text-muted-foreground italic">Other / unclassified</td>
                <td className="py-2 px-3 text-right">0</td>
                <td className="py-2 px-3 text-right">{otherOnSite}</td>
                <td className="py-2 px-3 text-right font-bold text-foreground">{otherOnSite}</td>
              </tr>
            )}
            <tr className="border-t-2 border-border font-bold">
              <td className="py-2 px-3 text-foreground">Total</td>
              <td className="py-2 px-3 text-right">{totalYard}</td>
              <td className="py-2 px-3 text-right">{totalSite}</td>
              <td className="py-2 px-3 text-right">
                <Badge variant="secondary" className="text-sm">{totalYard + totalSite}</Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
