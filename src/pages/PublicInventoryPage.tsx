import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const conditionStyle: Record<string, string> = {
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

const PublicInventoryPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "skip" | "roro">("all");

  useEffect(() => {
    document.title = "Skip & RoRo Inventory | WasteOne";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (typeFilter !== "all" && r.asset_type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.asset_number.toLowerCase().includes(q) ||
        (r.last_location || "").toLowerCase().includes(q) ||
        (r.size || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter]);

  const totalValue = filtered.reduce((s, r) => s + (r.value || 0), 0);

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
        <header>
          <h1 className="text-2xl font-bold">Skip &amp; RoRo Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {label ? `${label} · ` : ""}Read-only view · {items.length} assets
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
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
          {showValues && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Value (filtered)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">£{totalValue.toLocaleString()}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, size or location…"
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
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Repairs</TableHead>
                  <TableHead>Last location</TableHead>
                  <TableHead>Last catalogued</TableHead>
                  {showValues && <TableHead className="text-right">Value</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
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
                    <TableCell className="text-sm">{r.last_location || "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.last_cataloged_at
                        ? format(new Date(r.last_cataloged_at), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    {showValues && (
                      <TableCell className="text-right font-medium">
                        £{(r.value || 0).toLocaleString()}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default PublicInventoryPage;
