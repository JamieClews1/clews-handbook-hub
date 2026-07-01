import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MapPin, Download, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";

// "Other1" movement types in Skiptrak are NOT physical skip movements — they are
// rental payment lines for bins that stay on a customer's site. They are
// deliberately excluded from Live Jobs and Stock (which only count
// Deliver/Exchange/Collect/Tip/Return). This view surfaces them by postcode so
// the team can see which locations are being charged bin rental.

type OtherRentalJob = {
  id: string;
  job_number: string | null;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  postcode: string | null;
};

type PostcodeGroup = {
  postcode: string;
  displayPostcode: string;
  count: number;
  customers: string[];
  sites: string[];
  latestDate: string | null;
  jobs: OtherRentalJob[];
};

const normalisePostcode = (pc: string | null | undefined) =>
  (pc ?? "").toUpperCase().replace(/\s+/g, "");

const OtherRentalsPostcodes = () => {
  const [jobs, setJobs] = useState<OtherRentalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("id,job_number,job_date,customer,site,container_type,raw")
        .eq("source", "skiptrak")
        .eq("movement_type", "Other1")
        .order("job_date", { ascending: false })
        .limit(2000);

      if (!error && data) {
        setJobs(
          data.map((d: any) => ({
            id: d.id,
            job_number: d.job_number,
            job_date: d.job_date,
            customer: d.customer,
            site: d.site,
            container_type: d.container_type,
            postcode: d.raw?.["Location Postc"] ?? null,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  const groups = useMemo<PostcodeGroup[]>(() => {
    const map = new Map<string, PostcodeGroup>();
    for (const job of jobs) {
      const key = normalisePostcode(job.postcode) || "UNKNOWN";
      let g = map.get(key);
      if (!g) {
        g = {
          postcode: key,
          displayPostcode: (job.postcode?.trim() || "Unknown"),
          count: 0,
          customers: [],
          sites: [],
          latestDate: null,
          jobs: [],
        };
        map.set(key, g);
      }
      g.count++;
      g.jobs.push(job);
      if (job.customer && !g.customers.includes(job.customer)) g.customers.push(job.customer);
      if (job.site && !g.sites.includes(job.site)) g.sites.push(job.site);
      if (job.job_date && (!g.latestDate || job.job_date > g.latestDate)) g.latestDate = job.job_date;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.latestDate && b.latestDate) return b.latestDate.localeCompare(a.latestDate);
      if (a.latestDate) return -1;
      if (b.latestDate) return 1;
      return b.count - a.count;
    });
  }, [jobs]);
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.displayPostcode.toLowerCase().includes(q) ||
        g.postcode.toLowerCase().includes(q.replace(/\s+/g, "")) ||
        g.customers.some((c) => c.toLowerCase().includes(q)) ||
        g.sites.some((s) => s.toLowerCase().includes(q))
    );
  }, [groups, search]);

  const totalRentals = jobs.length;

  const exportCsv = () => {
    const rows: string[][] = [
      ["Postcode", "Rentals", "Customers", "Sites", "Latest date"],
      ...filtered.map((g) => [
        g.displayPostcode,
        String(g.count),
        g.customers.join("; "),
        g.sites.join("; "),
        g.latestDate ? format(new Date(g.latestDate), "dd/MM/yyyy") : "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `other1-rentals-by-postcode-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            "Other 1" bin rentals by postcode
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            "Other 1" jobs are bin rental charges for containers kept on customer sites — not
            physical skip movements. They are excluded from Live Jobs and Stock. Below shows every
            postcode that has had an "Other 1" rental raised against it.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {groups.length} postcodes
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {totalRentals} rentals
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search postcode, customer or site"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-72"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading rentals…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No "Other 1" rentals found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Postcode</TableHead>
                    <TableHead className="text-right">Rentals</TableHead>
                    <TableHead>Customer(s)</TableHead>
                    <TableHead>Site(s)</TableHead>
                    <TableHead>Latest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <Collapsible key={g.postcode} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
                            </TableCell>
                            <TableCell className="font-medium">{g.displayPostcode}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{g.count}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate">
                              {g.customers.join(", ")}
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate">
                              {g.sites.join(", ")}
                            </TableCell>
                            <TableCell>
                              {g.latestDate ? format(new Date(g.latestDate), "dd/MM/yyyy") : "—"}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
                              <div className="p-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Job #</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Customer</TableHead>
                                      <TableHead>Site</TableHead>
                                      <TableHead>Container</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {g.jobs.map((j) => (
                                      <TableRow key={j.id}>
                                        <TableCell>{j.job_number || "—"}</TableCell>
                                        <TableCell>
                                          {j.job_date
                                            ? format(new Date(j.job_date), "dd/MM/yyyy")
                                            : "—"}
                                        </TableCell>
                                        <TableCell>{j.customer || "—"}</TableCell>
                                        <TableCell>{j.site || "—"}</TableCell>
                                        <TableCell>{j.container_type || "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OtherRentalsPostcodes;
