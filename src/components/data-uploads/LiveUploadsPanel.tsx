import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

type UploadLogEntry = {
  id: string;
  source: string;
  file_name: string | null;
  row_count: number;
  uploaded_at: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LiveUploadsPanel() {
  const [entries, setEntries] = useState<UploadLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("data_upload_log")
      .select("id, source, file_name, row_count, uploaded_at")
      .gte("uploaded_at", since)
      .order("uploaded_at", { ascending: false })
      .limit(200);
    if (!error && data) setEntries(data as UploadLogEntry[]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 5000);
    return () => clearInterval(poll);
  }, []);

  const total = entries.length;
  const skiptrakCount = entries.filter((e) => e.source === "skiptrak").length;
  const midweighCount = entries.filter((e) => e.source === "midweigh").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                Upload activity log
              </CardTitle>
              <CardDescription>
                One entry per upload. Auto-refreshing every 5s · last refresh{" "}
                {lastRefresh.toLocaleTimeString()}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total uploads</div>
              <div className="text-2xl font-bold tabular-nums">{total.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Skiptrak uploads</div>
              <div className="text-2xl font-bold tabular-nums">{skiptrakCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Midweigh uploads</div>
              <div className="text-2xl font-bold tabular-nums">{midweighCount.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload history</CardTitle>
          <CardDescription>
            Showing upload events from the last 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto max-w-full">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Rows uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                      {loading ? "Loading…" : "No uploads recorded yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {formatDateTime(e.uploaded_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.source === "skiptrak" ? "default" : "secondary"}>
                          {e.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[28rem] truncate" title={e.file_name ?? ""}>
                        {e.file_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {e.row_count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
