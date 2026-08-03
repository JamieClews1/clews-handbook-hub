import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Scale, Search, Download, Loader2, CheckCircle2, AlertCircle, FileDown } from "lucide-react";
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

interface OrderInput {
  po: string;
  postcode: string;
}

interface ResultRow {
  requested: string;
  postcode: string;
  matches: JobWeight[];
}

const MAX_ORDERS = 500;

// Each line is "PO number, postcode" (also accepts space/tab/semicolon between).
// The first token is the PO number; everything after it is treated as the postcode.
function parseOrders(raw: string): OrderInput[] {
  const seen = new Set<string>();
  const out: OrderInput[] = [];
  raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/[,;\t]+|\s{2,}|\s+/).filter(Boolean);
      const po = parts[0];
      if (!po) return;
      const postcode = parts.slice(1).join(" ").trim();
      const key = `${po.toUpperCase()}|${postcode.replace(/\s+/g, "").toUpperCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ po, postcode });
      }
    });
  return out;
}

export default function WeightChecksPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [podJobs, setPodJobs] = useState<Set<string>>(new Set());
  const [podLoading, setPodLoading] = useState<string | null>(null);

  const handlePodDownload = async (jobNumber: string) => {
    setPodLoading(jobNumber);
    try {
      const { data, error } = await supabase.functions.invoke("pod-lookup", {
        body: { job_number: jobNumber },
      });
      if (error) throw error;
      if (!data?.url) {
        toast({ title: "No POD available", description: `No proof of delivery found for job ${jobNumber}.` });
        return;
      }
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.file_name ?? `POD-${jobNumber}.pdf`;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch (e: any) {
      toast({ title: "POD download failed", description: e?.message, variant: "destructive" });
    } finally {
      setPodLoading(null);
    }
  };


  const handleLookup = async () => {
    const orders = parseOrders(input);
    if (orders.length === 0) {
      toast({
        title: "No order numbers",
        description: "Paste one or more order / PO numbers (with postcode) to check.",
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

    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.rpc("lookup_job_weights", {
        pairs: orders.map((o) => ({ po: o.po, postcode: o.postcode })),
      });
      if (error) throw error;

      const rows = (data ?? []) as JobWeight[];

      const mapped: ResultRow[] = orders.map((o) => {
        const pcKey = o.postcode.replace(/\s+/g, "").toUpperCase();
        const matches = rows.filter(
          (row) =>
            row.order_number.toUpperCase() === o.po.toUpperCase() &&
            (pcKey === "" ||
              (row.postcode ?? "").replace(/\s+/g, "").toUpperCase() === pcKey)
        );
        return { requested: o.po, postcode: o.postcode, matches };
      });
      setResults(mapped);

      // Which of these jobs have a proof of delivery on file
      const jobNumbers = Array.from(
        new Set(mapped.flatMap((r) => r.matches.map((m) => m.job_number)).filter(Boolean))
      );
      setPodJobs(new Set());
      if (jobNumbers.length > 0) {
        const { data: podData } = await supabase.functions.invoke("pod-lookup", {
          body: { job_numbers: jobNumbers },
        });
        if (podData?.available) setPodJobs(new Set(podData.available.map(String)));
      }

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
              Paste one line per job as <span className="font-medium">PO number,
              postcode</span> to instantly see the recorded weight for each job.
              You can check up to {MAX_ORDERS} at a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orders">Order / PO number, postcode</Label>
              <Textarea
                id="orders"
                placeholder={"PO12345, CV23 8UN\nPO67890, LE17 4XR\nPO54321, CV21 1HA"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {parseOrders(input).length} order number(s) entered · one per line,
                e.g. <span className="font-mono">PO12345, CV23 8UN</span>
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
                      <th className="py-2 pr-4 font-medium">Postcode</th>
                      <th className="py-2 pr-4 font-medium">Waste type</th>
                      <th className="py-2 pr-4 font-medium text-right">Weight</th>
                      <th className="py-2 font-medium text-right">POD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) =>
                      r.matches.length === 0 ? (
                        <tr key={r.requested} className="border-b">
                          <td className="py-2 pr-4 font-mono">{r.requested}</td>
                          <td className="py-2 pr-4" colSpan={5}>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              No matching job found
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right">—</td>
                          <td className="py-2 text-right">—</td>
                        </tr>
                      ) : (
                        r.matches.map((m, i) => (
                          <tr key={`${r.requested}-${m.job_number}-${i}`} className="border-b">
                            <td className="py-2 pr-4 font-mono">{r.requested}</td>
                            <td className="py-2 pr-4">{m.job_number}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{formatDate(m.job_date)}</td>
                            <td className="py-2 pr-4">{m.site ?? "—"}</td>
                            <td className="py-2 pr-4 font-mono whitespace-nowrap">{m.postcode ?? "—"}</td>
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
                            <td className="py-2 text-right whitespace-nowrap">
                              {podJobs.has(String(m.job_number)) ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  disabled={podLoading === m.job_number}
                                  onClick={() => handlePodDownload(m.job_number)}
                                >
                                  {podLoading === m.job_number ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="h-3.5 w-3.5" />
                                  )}
                                  POD
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
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
