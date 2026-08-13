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

const conditionStyle: Record<string, string> = {
  New: "bg-lime-500/15 text-lime-700 border-lime-500/30",
  Good: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Fair: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Poor: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Damaged: "bg-red-500/15 text-red-700 border-red-500/30",
  Scrapped: "bg-red-600 text-white border-red-700",
  "Yard Use": "bg-blue-500/15 text-blue-700 border-blue-500/30",
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
}

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

const PublicInventoryPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "skip" | "roro">("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [photoItem, setPhotoItem] = useState<Item | null>(null);

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
      if (typeFilter !== "all" && r.asset_type !== typeFilter) return false;
      if (conditionFilter !== "all" && (r.condition || "") !== conditionFilter) return false;
      if (!q) return true;
      return (
        r.asset_number.toLowerCase().includes(q) ||
        (r.last_location || "").toLowerCase().includes(q) ||
        (r.size || "").toLowerCase().includes(q) ||
        (r.condition || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, conditionFilter]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => compareAssetNumbers(a.asset_number, b.asset_number)),
    [filtered],
  );

  const totalValue = filtered.reduce((s, r) => s + (r.value || 0), 0);
  const portfolioValue = items.reduce((s, r) => s + (r.value || 0), 0);
  const repairsCount = items.filter((i) => i.repairs_required).length;

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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total assets</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{items.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skips</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">
                {items.filter((i) => i.asset_type === "skip").length}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">RoRos</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">
                {items.filter((i) => i.asset_type === "roro").length}
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
                  Indicative value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{money(portfolioValue)}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="assets">
          <TabsList className="print:hidden">
            <TabsTrigger value="assets">Asset list</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="space-y-4">
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
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-3 h-8 rounded-md text-xs font-semibold capitalize transition-colors",
                      typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t === "roro" ? "RoRo" : t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {["all", ...conditions].map((c) => (
                  <button
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
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {items.length} assets
              {showValues ? ` · ${money(totalValue)} filtered value` : ""}
            </p>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {showPhotos && <TableHead className="w-16">Photo</TableHead>}
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Repairs</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Last location</TableHead>
                      <TableHead>Last catalogued</TableHead>
                      {showValues && <TableHead className="text-right">Value</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        {showPhotos && (
                          <TableCell>
                            {r.photos?.length ? (
                              <button onClick={() => setPhotoItem(r)} className="relative block">
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
                              </button>
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
                        <TableCell className="text-sm">
                          {r.repairs_required ? (
                            <span className="text-red-600 font-medium">Required</span>
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
                            {money(r.value || 0)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
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
