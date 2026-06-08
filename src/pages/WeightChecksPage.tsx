import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Scale, Search, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import w1Logo from "@/assets/w1-logo.png";

interface JobWeight {
  order_number: string;
  job_number: string;
  source: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  waste_description: string | null;
  container_type: string | null;
  weight_t: number | null;
  postcode: string | null;
}

interface ResultRow {
  requested: string;
  matches: JobWeight[];
}

const MAX_ORDERS = 500;

function parseOrders(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  raw
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      const key = s.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    });
  return out;
}

export default function WeightChecksPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const handleLookup = async () => {
    const orders = parseOrders(input);
    if (orders.length === 0) {
      toast({
        title: "No order numbers",
        description: "Paste one or more order / PO numbers to check.",
        variant: "destructive",
      });
      return;
    }
    if (orders.length > MAX_ORDERS) {
      toast({
        title: "Too many order numbers",
        description: `Please check up to ${MAX_ORDERS} order numbers at a time.`,
        variant: "destructive",
      });
      return;
    }
    if (!postcode.trim()) {
      toast({
        title: "Postcode required",
        description: "Enter the site postcode to verify your jobs.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.rpc("lookup_job_weights", {
        order_numbers: orders,
        p_postcode: postcode.trim(),
      });
      if (error) throw error;

      const rows = (data ?? []) as JobWeight[];
      const byOrder = new Map<string, JobWeight[]>();
      for (const row of rows) {
        const key = row.order_number.toUpperCase();
        if (!byOrder.has(key)) byOrder.set(key, []);
        byOrder.get(key)!.push(row);
      }

      const mapped: ResultRow[] = orders.map((o) => ({
        requested: o,
        matches: byOrder.get(o.toUpperCase()) ?? [],
      }));
      setResults(mapped);
    } catch (err) {
      console.error("Weight check failed", err);
      toast({
        title: "Lookup failed",
        description: "We couldn't retrieve weights right now. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatWeight = (w: number | null) =>
    w === null || w === undefined ? "Pending" : `${Number(w).toFixed(2)} t`;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d + "T00:00:00Z");
    return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
  };

  const downloadCsv = () => {
    if (!results) return;
    const header = [
      "Order/PO Number",
      "Status",
      "Job Number",
      "Date",
      "Customer",
      "Site",
      "Postcode",
      "Waste Type",
      "Container",
      "Weight (t)",
    ];
    const lines = [header];
    for (const r of results) {
      if (r.matches.length === 0) {
        lines.push([r.requested, "Not found", "", "", "", "", "", "", "", ""]);
      } else {
        for (const m of r.matches) {
          lines.push([
            r.requested,
            m.weight_t === null ? "Awaiting weight" : "Weighed",
            m.job_number,
            formatDate(m.job_date),
            m.customer ?? "",
            m.site ?? "",
            m.postcode ?? "",
            m.waste_description ?? "",
            m.container_type ?? "",
            m.weight_t === null ? "" : Number(m.weight_t).toFixed(2),
          ]);
        }
      }
    }
    const csv = lines
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weight-checks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalMatches = results?.reduce((n, r) => n + r.matches.length, 0) ?? 0;
  const notFound = results?.filter((r) => r.matches.length === 0).length ?? 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <img src={w1Logo} alt="WasteOne" className="h-9 w-auto" />
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Weight Checks</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Check load weights by order number</CardTitle>
            <CardDescription>
              Paste your order / PO numbers below (one per line) to instantly see
              the recorded weight for each job. You can check up to {MAX_ORDERS} at
              a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orders">Order / PO numbers</Label>
              <Textarea
                id="orders"
                placeholder={"26137594730\n26137622838\n26137647330"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {parseOrders(input).length} order number(s) entered
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Site postcode</Label>
              <Input
                id="postcode"
                placeholder="e.g. CV23 8UN"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="max-w-xs font-mono text-sm uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Enter the delivery / collection postcode to verify your jobs.
              </p>
            </div>
            <Button onClick={handleLookup} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? "Checking..." : "Check weights"}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {totalMatches} job(s) found across {results.length} order
                  number(s){notFound > 0 ? ` · ${notFound} not found` : ""}.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Order / PO</th>
                      <th className="py-2 pr-4 font-medium">Job</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Site</th>
                      <th className="py-2 pr-4 font-medium">Waste type</th>
                      <th className="py-2 pr-4 font-medium text-right">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) =>
                      r.matches.length === 0 ? (
                        <tr key={r.requested} className="border-b">
                          <td className="py-2 pr-4 font-mono">{r.requested}</td>
                          <td className="py-2 pr-4" colSpan={4}>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              No matching job found
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right">—</td>
                        </tr>
                      ) : (
                        r.matches.map((m, i) => (
                          <tr key={`${r.requested}-${m.job_number}-${i}`} className="border-b">
                            <td className="py-2 pr-4 font-mono">{r.requested}</td>
                            <td className="py-2 pr-4">{m.job_number}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{formatDate(m.job_date)}</td>
                            <td className="py-2 pr-4">{m.site ?? "—"}</td>
                            <td className="py-2 pr-4">{m.waste_description ?? "—"}</td>
                            <td className="py-2 pr-4 text-right whitespace-nowrap">
                              {m.weight_t === null ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Loader2 className="h-3 w-3" />
                                  Awaiting weight
                                </Badge>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                  {formatWeight(m.weight_t)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
