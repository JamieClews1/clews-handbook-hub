import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, Download, ImageIcon, Loader2, Printer, Search } from "lucide-react";
import { cn, compareAssetNumbers } from "@/lib/utils";
import { format } from "date-fns";
import type { buyerValuation } from "../../supabase/functions/_shared/inventory-valuation";

const conditionStyle: Record<string, string> = {
  New: "bg-primary/10 text-primary border-primary/30",
  Good: "bg-primary/10 text-primary border-primary/30",
  Fair: "bg-warning/10 text-warning border-warning/30",
  Poor: "bg-warning/10 text-warning border-warning/30",
  Damaged: "bg-destructive/10 text-destructive border-destructive/30",
  Scrapped: "bg-destructive text-destructive-foreground border-destructive",
  "Yard Use": "bg-info/10 text-info border-info/30",
};

interface Item {
  id: string;
  asset_number: string;
  asset_type: string;
  size: string | null;
  condition: string | null;
  repairs_required: boolean;
  repair_notes: string | null;
  last_location: string | null;
  last_cataloged_at: string | null;
  photos: string[];
  value: number | null;
  office_verified: boolean;
}

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

interface ExpectedSnapshot {
  expected_skip: number;
  expected_roro: number;
  expected_total: number;
  computed_at: string;
  total_report?: {
    computed_at?: string;
    excluded: number;
    skip: { out: number; yard: number; required: number };
    roro: { out: number; yard: number; required: number };
    rowsByType: { id: string; name: string; category: string; inYard: number; onSiteClews: number; fleet: number; catalogued: number; required: number }[];
  } | null;
}

const PublicInventoryPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [expected, setExpected] = useState<ExpectedSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "skip" | "roro">("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [photoItem, setPhotoItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState("total");
  const [valuation, setValuation] = useState<ReturnType<typeof buyerValuation> | null>(null);

  useEffect(() => {
    document.title = "Skip & RoRo Asset Inventory | WasteOne";
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        "content",
        "Read-only asset inventory of skips and roll-on/roll-off containers, with condition, location and indicative valuation.",
      );
    const run = async () => {
      try {
        const res = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-inventory?token=${encodeURIComponent(token ?? "")}`,
        );
        const body = await res.json();
        if (!res.ok) {
          setError(body?.error || "Unable to load inventory");
        } else {
          setLabel(body.label);
          setShowValues(!!body.show_values);
          setShowPhotos(!!body.show_photos);
          setItems(body.items || []);
          setExpected(body.expected ?? null);
          setValuation(body.valuation ?? null);
        }
      } catch {
        setError("Unable to load inventory");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

  const conditions = useMemo(
    () => Array.from(new Set(items.map((i) => i.condition).filter(Boolean))) as string[],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (activeTab === "unverified" && r.office_verified) return false;
      if (typeFilter !== "all" && r.asset_type !== typeFilter) return false;
      if (conditionFilter !== "all" && (r.condition || "") !== conditionFilter) return false;
      if (!q) return true;
      return (
        r.asset_number.toLowerCase().includes(q) ||
        (r.last_location || "").toLowerCase().includes(q) ||
        (r.size || "").toLowerCase().includes(q) ||
        (r.repair_notes || "").toLowerCase().includes(q) ||
        (r.condition || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, conditionFilter, activeTab]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => compareAssetNumbers(a.asset_number, b.asset_number)),
    [filtered],
  );

  const totalValue = filtered.reduce((s, r) => s + (r.value || 0), 0);
  const portfolioValue = items.reduce((s, r) => s + (r.value || 0), 0);
  const repairsCount = items.filter((i) => i.repairs_required).length;

  const accounted = useMemo(() => {
    if (!expected || expected.expected_total <= 0) return null;
    const skips = items.filter((i) => i.asset_type === "skip").length;
    const roros = items.filter((i) => i.asset_type === "roro").length;
    const pct = (n: number, d: number) =>
      d > 0 ? Math.min(100, Math.round((n / d) * 100)) : null;
    return {
      totalPct: pct(items.length, expected.expected_total),
      skipPct: pct(skips, expected.expected_skip),
      roroPct: pct(roros, expected.expected_roro),
    };
  }, [items, expected]);

  const breakdown = useMemo(() => {
    const map = new Map<
      string,
      { type: string; size: string; condition: string; count: number; value: number }
    >();
    items.forEach((i) => {
      const key = `${i.asset_type}|${i.size || "—"}|${i.condition || "—"}`;
      const row =
        map.get(key) ??
        {
          type: i.asset_type,
          size: i.size || "—",
          condition: i.condition || "—",
          count: 0,
          value: 0,
        };
      row.count += 1;
      row.value += i.value || 0;
      map.set(key, row);
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        a.type.localeCompare(b.type) ||
        a.size.localeCompare(b.size) ||
        a.condition.localeCompare(b.condition),
    );
  }, [items]);

  const exportCsv = () => {
    const head = [
      "Asset number",
      "Type",
      "Size",
      "Condition",
      "Repairs required",
      "Repair notes",
      "Last location",
      "Last catalogued",
      "Office verified",
      ...(showValues ? ["Value (GBP)"] : []),
    ];
    const rows = sortedFiltered.map((r) => [
      r.asset_number,
      r.asset_type === "roro" ? "RoRo" : "Skip",
      r.size || "",
      r.condition || "",
      r.repairs_required ? "Yes" : "No",
      r.repair_notes || "",
      r.last_location || "",
      r.last_cataloged_at ? format(new Date(r.last_cataloged_at), "yyyy-MM-dd") : "",
      r.office_verified ? "Yes" : "No",
      ...(showValues ? [String(r.value ?? 0)] : []),
    ]);
    const csv = [head, ...rows]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `asset-inventory-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <Boxes className="h-12 w-12 opacity-30" />
        <h1 className="text-xl font-semibold">Inventory unavailable</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Skip &amp; RoRo Asset Inventory</h1>
            <p className="text-sm text-muted-foreground">
              {label ? `${label} · ` : ""}Read-only view · {items.length} assets · as at{" "}
              {format(new Date(), "d MMM yyyy")}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated owned fleet</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{expected?.total_report ? expected.total_report.skip.out + expected.total_report.skip.yard + expected.total_report.roro.out + expected.total_report.roro.yard : "—"}</span>
              <p className="text-xs text-muted-foreground">On site + counted yard</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skips</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">
                {expected?.total_report ? expected.total_report.skip.out + expected.total_report.skip.yard : "—"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">RoRos</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">
                {expected?.total_report ? expected.total_report.roro.out + expected.total_report.roro.yard : "—"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Repairs required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{repairsCount}</span>
            </CardContent>
          </Card>
          {showValues && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Estimated fleet value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{valuation ? money(valuation.confirmedValue + valuation.assumedValue) : "—"}</span>
                {valuation && <p className="text-xs text-muted-foreground">{valuation.unvalued > 0 ? `${valuation.unvalued} containers unvalued · partial estimate` : "Verified + 50% Good / 50% Fair"}</p>}
              </CardContent>
            </Card>
          )}
          {accounted && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bins accounted for
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <span className="text-3xl font-bold">{accounted.totalPct}%</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      (accounted.totalPct ?? 0) >= 90
                        ? "bg-primary"
                        : (accounted.totalPct ?? 0) >= 60
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${accounted.totalPct ?? 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  of expected fleet catalogued
                  {accounted.skipPct !== null ? ` · skips ${accounted.skipPct}%` : ""}
                  {accounted.roroPct !== null ? ` · RoRos ${accounted.roroPct}%` : ""}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="print:hidden h-auto flex flex-wrap w-fit max-w-full">
            <TabsTrigger value="assets">Profiles ({items.length})</TabsTrigger>
            <TabsTrigger value="unverified">Not office verified ({items.filter(i => !i.office_verified).length})</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="total">Total Report</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab === "unverified" ? "unverified" : "assets"} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center print:hidden">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search number, size, condition or location…"
                  className="pl-9"
                />
              </div>
              <div className="flex rounded-lg border p-0.5 w-fit">
                {(["all", "skip", "roro"] as const).map((t) => (
                  <Button variant="ghost"
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-3 h-8 rounded-md text-xs font-semibold capitalize transition-colors",
                      typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t === "roro" ? "RoRo" : t}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {["all", ...conditions].map((c) => (
                  <Button variant="ghost"
                    key={c}
                    onClick={() => setConditionFilter(c)}
                    className={cn(
                      "px-2.5 h-8 rounded-md border text-xs font-medium transition-colors",
                      conditionFilter === c
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {c === "all" ? "All conditions" : c}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {items.length} assets
              {showValues ? ` · ${money(totalValue)} filtered value` : ""}
            </p>

            <div className="border rounded-lg min-w-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {showPhotos && <TableHead className="w-16">Photo</TableHead>}
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Office verified</TableHead>
                      <TableHead>Repairs</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Last location</TableHead>
                      <TableHead>Last catalogued</TableHead>
                      {showValues && <TableHead className="text-right">Value</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFiltered.map((r) => (
                      <TableRow key={r.id}>
                        {showPhotos && (
                          <TableCell>
                            {r.photos?.length ? (
                              <Button variant="ghost" onClick={() => setPhotoItem(r)} className="relative block h-auto p-0" aria-label={`View photos for ${r.asset_number}`}>
                                <img
                                  src={r.photos[0]}
                                  alt={`Asset ${r.asset_number} ${r.asset_type === "roro" ? "RoRo" : "skip"} container`}
                                  loading="lazy"
                                  className="h-10 w-14 rounded object-cover border"
                                />
                                {r.photos.length > 1 && (
                                  <span className="absolute -top-1 -right-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1">
                                    {r.photos.length}
                                  </span>
                                )}
                              </Button>
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-semibold whitespace-nowrap">
                          #{r.asset_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {r.asset_type === "roro" ? "RoRo" : "Skip"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{r.size || "—"}</TableCell>
                        <TableCell>
                          {r.condition ? (
                            <Badge
                              variant="outline"
                              className={cn("text-xs", conditionStyle[r.condition] || "")}
                            >
                              {r.condition}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={r.office_verified ? "secondary" : "outline"}>{r.office_verified ? "Verified" : "Not verified"}</Badge></TableCell>
                        <TableCell className="text-sm">
                          {r.repairs_required ? (
                            <span className="text-destructive font-medium">Required</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[240px] truncate" title={r.repair_notes || ""}>
                          {r.repair_notes || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{r.last_location || "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {r.last_cataloged_at
                            ? format(new Date(r.last_cataloged_at), "d MMM yyyy")
                            : "—"}
                        </TableCell>
                        {showValues && (
                          <TableCell className="text-right font-medium">
                            {r.value == null ? "Not valued" : money(r.value)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fleet breakdown by type, size and condition</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        {showValues && <TableHead className="text-right">Value</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((b) => (
                        <TableRow key={`${b.type}-${b.size}-${b.condition}`}>
                          <TableCell className="capitalize">
                            {b.type === "roro" ? "RoRo" : "Skip"}
                          </TableCell>
                          <TableCell>{b.size}</TableCell>
                          <TableCell>{b.condition}</TableCell>
                          <TableCell className="text-right font-medium">{b.count}</TableCell>
                          {showValues && (
                            <TableCell className="text-right font-medium">{money(b.value)}</TableCell>
                          )}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right">{items.length}</TableCell>
                        {showValues && (
                          <TableCell className="text-right">{money(portfolioValue)}</TableCell>
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="total">
            {!expected?.total_report ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">The Total Report isn't available yet.</CardContent></Card>
            ) : (() => {
              const r = expected.total_report;
              return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Total Report</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Customer-owned skips/RoRos and Scrapped / Yard Use bins are excluded.
                      {r.computed_at && ` Updated ${new Date(r.computed_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {valuation && showValues && <section className="space-y-3 border-b pb-4">
                      <h2 className="font-semibold">Fleet valuation</h2>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div><p className="text-sm text-muted-foreground">Office-verified profiles ({valuation.verified})</p><p className="text-2xl font-bold tabular-nums">{money(valuation.confirmedValue)}</p></div>
                        <div><p className="text-sm text-muted-foreground">Remaining containers ({valuation.assumed})</p><p className="text-2xl font-bold tabular-nums">{money(valuation.assumedValue)}</p><Badge variant="secondary">50% Good · 50% Fair</Badge></div>
                        <div><p className="text-sm text-muted-foreground">Combined indicative value</p><p className="text-2xl font-bold tabular-nums">{money(valuation.confirmedValue + valuation.assumedValue)}</p></div>
                      </div>
                      <p className="text-sm font-medium text-primary">Assumed valuation by bin type: 50% Good and 50% Fair.</p>
                      <p className="text-xs text-muted-foreground">Remaining containers include unverified profiles and bins still to be found. Each type uses an equal blend of its configured Good and Fair rates. Half-bin quantities for odd totals are valuation weights only, not physical counts. This is not a formal valuation.</p>
                      {(valuation.unvalued > 0 || valuation.surplus > 0 || valuation.unmatchedVerified > 0) && <p className="text-sm text-destructive">{valuation.unvalued} containers without a valuation · {valuation.surplus} excess verified profiles · {valuation.unmatchedVerified} verified profiles with unmatched sizes. Differences remain unresolved.</p>}
                      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Bin type</TableHead><TableHead>Verified</TableHead><TableHead>Verified value</TableHead><TableHead>To find / verify</TableHead><TableHead>50% Good</TableHead><TableHead>Good / bin</TableHead><TableHead>50% Fair</TableHead><TableHead>Fair / bin</TableHead><TableHead>Assumed value</TableHead></TableRow></TableHeader><TableBody>{valuation.rows.map(t => <TableRow key={t.id}><TableCell>{t.name}</TableCell><TableCell>{t.verified}</TableCell><TableCell>{money(t.confirmedValue)}</TableCell><TableCell className="font-semibold">{t.assumed}</TableCell><TableCell>{t.assumedGood}</TableCell><TableCell>{t.goodRate == null ? "Not set" : money(t.goodRate)}</TableCell><TableCell>{t.assumedFair}</TableCell><TableCell>{t.fairRate == null ? "Not set" : money(t.fairRate)}</TableCell><TableCell>{t.assumedValue == null ? "Not valued" : money(t.assumedValue)}</TableCell></TableRow>)}</TableBody></Table></div>
                    </section>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Out on Live Jobs (exc. Own)", k: "out" as const },
                        { label: "In Yard (spare stock)", k: "yard" as const },
                        { label: "Profiles still required", k: "required" as const },
                      ].map((c) => (
                        <div key={c.k} className="rounded-lg border border-border p-3">
                          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums">{r.skip[c.k] + r.roro[c.k]}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">Skips {r.skip[c.k]} · RoRos {r.roro[c.k]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Out on jobs</TableHead>
                            <TableHead className="text-right">In yard</TableHead>
                            <TableHead className="text-right">Est. fleet</TableHead>
                            <TableHead className="text-right">Profiles</TableHead>
                            <TableHead className="text-right">Still required</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.rowsByType.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>{t.name} <span className="text-[11px] text-muted-foreground">{t.category === "roro" ? "RoRo" : "Skip"}</span></TableCell>
                              <TableCell className="text-right tabular-nums">{t.onSiteClews}</TableCell>
                              <TableCell className="text-right tabular-nums">{t.inYard}</TableCell>
                              <TableCell className="text-right tabular-nums">{t.fleet}</TableCell>
                              <TableCell className="text-right tabular-nums">{t.catalogued}</TableCell>
                              <TableCell className={`text-right tabular-nums ${t.required > 0 ? "text-destructive font-semibold" : ""}`}>{t.required}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        </Tabs>

        {showValues && (
          <p className="text-xs text-muted-foreground">
            Values shown are indicative internal estimates based on asset size and condition, provided
            for information only and not a formal valuation or offer.
          </p>
        )}
      </div>

      <Dialog open={!!photoItem} onOpenChange={(o) => !o && setPhotoItem(null)}>
        <DialogContent className="max-w-4xl">
          <h2 className="font-semibold">
            #{photoItem?.asset_number} · {photoItem?.asset_type === "roro" ? "RoRo" : "Skip"}
            {photoItem?.size ? ` · ${photoItem.size}` : ""}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[75vh] overflow-y-auto">
            {(photoItem?.photos ?? []).map((p) => (
              <a key={p} href={p} target="_blank" rel="noreferrer">
                <img
                  src={p}
                  alt={`Asset ${photoItem?.asset_number} container photo`}
                  className="w-full rounded-lg border object-cover"
                />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PublicInventoryPage;
