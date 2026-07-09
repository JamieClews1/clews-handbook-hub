import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Send, ClipboardList, CheckCircle2, Building2, MapPin } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: string;
  customer_name: string;
  po_notification_email: string | null;
};

type Site = {
  id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
};

type JobRecord = {
  id: string;
  job_date: string;
  job_number: string;
  waste_description: string | null;
  container_type: string | null;
  ewc: string | null;
  weight_t: number | null;
  site: string | null;
  raw: unknown;
  order_number_override: string | null;
};

// --- Identical PO logic to /My-portal (CustomerPortalPORequests) ---

const getRawOrderNumber = (job: JobRecord): string | null => {
  const rawObj =
    job.raw && typeof job.raw === "object" && !Array.isArray(job.raw)
      ? (job.raw as Record<string, unknown>)
      : null;
  const orderNo = rawObj?.["Order No"];
  if (typeof orderNo === "string" && orderNo.trim()) return orderNo.trim();
  if (typeof orderNo === "number") return String(orderNo);
  return null;
};

const getEffectivePO = (job: JobRecord): string | null => {
  if (job.order_number_override && job.order_number_override.trim()) {
    return job.order_number_override.trim();
  }
  return getRawOrderNumber(job);
};

// "No PO" = blank / missing OR the literal placeholder "TBC"
const isMissingPO = (job: JobRecord): boolean => {
  const eff = getEffectivePO(job);
  if (!eff) return true;
  const t = eff.trim().toUpperCase();
  return t === "" || t === "TBC";
};

const getCost = (job: JobRecord): number => {
  const rawObj =
    job.raw && typeof job.raw === "object" && !Array.isArray(job.raw)
      ? (job.raw as Record<string, unknown>)
      : null;
  const cost = rawObj?.["Cost"];
  if (typeof cost === "number") return cost;
  if (typeof cost === "string") {
    const n = parseFloat(cost.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

const LOOKBACK_OPTIONS = [
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
];

type WasteGroup = {
  key: string;
  wasteType: string;
  periodLabel: string | null;
  jobs: JobRecord[];
};

type SiteGroup = {
  siteName: string;
  jobs: JobRecord[];
  wasteGroups: WasteGroup[];
  totalWeight: number;
  totalCost: number;
};

export function PoChecksDashboard() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [sites, setSites] = useState<Site[]>([]);
  const [jobRecords, setJobRecords] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookback, setLookback] = useState("6");
  // When true, only show jobs already completed (up to today) and exclude future-dated jobs
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [recipients, setRecipients] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sendingSite, setSendingSite] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId) || null;
  const customerName = selectedCustomer?.customer_name || "";
  const isBiffa = customerName.toLowerCase().includes("biffa");

  // Load active customers
  useEffect(() => {
    const loadCustomers = async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, customer_name, po_notification_email")
        .eq("is_active", true)
        .order("customer_name");
      setCustomers(data ?? []);
    };
    loadCustomers();
  }, []);

  // Load sites when a customer is chosen
  useEffect(() => {
    const loadSites = async () => {
      if (!customerId) {
        setSites([]);
        return;
      }
      const { data } = await supabase
        .from("customer_sites")
        .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
        .eq("customer_id", customerId)
        .order("site_name");
      setSites(data ?? []);
    };
    loadSites();
  }, [customerId]);

  // Pre-fill recipients with the customer's PO notification email + portal contacts
  useEffect(() => {
    const loadRecipients = async () => {
      if (!customerId) {
        setRecipients("");
        return;
      }
      const emails = new Set<string>();
      if (selectedCustomer?.po_notification_email) emails.add(selectedCustomer.po_notification_email.trim());
      const { data: contacts } = await supabase
        .from("customer_contacts")
        .select("email")
        .eq("customer_id", customerId);
      (contacts ?? []).forEach((c) => c.email && emails.add(c.email.trim()));
      setRecipients(Array.from(emails).join(", "));
    };
    loadRecipients();
  }, [customerId, selectedCustomer?.po_notification_email]);

  const siteNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sites) {
      [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
        .filter(Boolean)
        .forEach((alias) => map.set(alias as string, s.site_name));
    }
    return map;
  }, [sites]);

  const loadJobs = useCallback(async () => {
    if (!customerId || sites.length === 0) {
      setJobRecords([]);
      return;
    }
    setLoading(true);
    try {
      const startDate = format(subMonths(new Date(), parseInt(lookback, 10)), "yyyy-MM-dd");
      const endDate = onlyCompleted
        ? format(new Date(), "yyyy-MM-dd")
        : format(addMonths(new Date(), 12), "yyyy-MM-dd");

      const siteNames = new Set<string>();
      const customerFilters = new Set<string>();
      for (const s of sites) {
        [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
          .filter(Boolean)
          .forEach((n) => siteNames.add(n as string));
        if (s.data_hub_customer) customerFilters.add(s.data_hub_customer);
      }

      if (siteNames.size === 0 && customerFilters.size === 0) {
        setJobRecords([]);
        return;
      }

      let query = supabase
        .from("data_hub_jobs")
        .select("id, job_date, job_number, waste_description, container_type, ewc, weight_t, site, raw, order_number_override")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      if (customerFilters.size > 0) query = query.in("customer", Array.from(customerFilters));
      if (siteNames.size > 0) query = query.in("site", Array.from(siteNames));

      const { data, error } = await query;
      if (error) throw error;

      setJobRecords((data ?? []).filter(isMissingPO));
    } catch (error) {
      console.error("Error loading PO checks:", error);
      toast({ title: "Error", description: "Failed to load jobs.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [customerId, sites, lookback, onlyCompleted, toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Group missing-PO jobs by site, then by waste type (per month for Biffa) — same PO grouping logic as the portal
  const siteGroups = useMemo<SiteGroup[]>(() => {
    const bySite = new Map<string, JobRecord[]>();
    for (const job of jobRecords) {
      const siteName = (job.site && siteNameLookup.get(job.site)) || job.site || "Unknown site";
      if (!bySite.has(siteName)) bySite.set(siteName, []);
      bySite.get(siteName)!.push(job);
    }

    const result: SiteGroup[] = [];
    for (const [siteName, jobs] of bySite.entries()) {
      const map = new Map<string, WasteGroup>();
      for (const job of jobs) {
        const wasteType = job.waste_description?.trim() || "Unspecified waste";
        const monthKey = job.job_date ? job.job_date.slice(0, 7) : "unknown";
        const periodLabel = isBiffa && job.job_date ? format(new Date(job.job_date + "T00:00:00"), "MMMM yyyy") : null;
        const key = isBiffa ? `${monthKey}__${wasteType}` : wasteType;
        let g = map.get(key);
        if (!g) {
          g = { key, wasteType, periodLabel, jobs: [] };
          map.set(key, g);
        }
        g.jobs.push(job);
      }
      const wasteGroups = Array.from(map.values()).sort((a, b) => {
        if (isBiffa) {
          const am = a.jobs[0]?.job_date ?? "";
          const bm = b.jobs[0]?.job_date ?? "";
          if (am !== bm) return bm.localeCompare(am);
        }
        return a.wasteType.localeCompare(b.wasteType);
      });
      result.push({
        siteName,
        jobs,
        wasteGroups,
        totalWeight: jobs.reduce((s, j) => s + (j.weight_t || 0), 0),
        totalCost: jobs.reduce((s, j) => s + getCost(j), 0),
      });
    }
    return result.sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [jobRecords, siteNameLookup, isBiffa]);

  const totalMissing = jobRecords.length;
  const totalValue = jobRecords.reduce((s, j) => s + getCost(j), 0);

  const parseRecipients = () =>
    recipients
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

  const buildItems = (groups: SiteGroup[]) =>
    groups.flatMap((sg) =>
      sg.wasteGroups.map((wg) => ({
        siteName: sg.siteName,
        wasteType: wg.wasteType,
        periodLabel: wg.periodLabel,
        jobCount: wg.jobs.length,
        totalWeight: wg.jobs.reduce((s, j) => s + (j.weight_t || 0), 0),
        totalCost: wg.jobs.reduce((s, j) => s + getCost(j), 0),
      }))
    );

  // Send a single request email for the given site groups. When `siteLabel` is
  // provided the email subject is scoped to that individual site.
  const sendRequestFor = async (
    groups: SiteGroup[],
    recipientList: string[],
    requestedBy: string,
    siteLabel?: string
  ) => {
    const items = buildItems(groups);
    if (items.length === 0) return;
    const { error } = await supabase.functions.invoke("po-request-email", {
      body: {
        customerName,
        siteName: siteLabel ?? null,
        recipients: recipientList,
        requestedBy,
        items,
      },
    });
    if (error) throw error;
  };

  // Send an individual PO request for a single site.
  const sendSitePORequest = async (sg: SiteGroup) => {
    const recipientList = parseRecipients();
    if (recipientList.length === 0) {
      toast({ title: "No recipients", description: "Add at least one email address.", variant: "destructive" });
      return;
    }

    setSendingSite(sg.siteName);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const requestedBy = userData.user?.email || "Clews team";
      await sendRequestFor([sg], recipientList, requestedBy, sg.siteName);
      toast({
        title: "PO request sent",
        description: `Emailed ${recipientList.length} recipient${recipientList.length === 1 ? "" : "s"} for ${sg.siteName}.`,
      });
    } catch (error: any) {
      console.error("Error sending site PO request:", error);
      toast({ title: "Error", description: error?.message || "Failed to send PO request.", variant: "destructive" });
    } finally {
      setSendingSite(null);
    }
  };

  const sendPORequest = async () => {
    const recipientList = parseRecipients();

    if (recipientList.length === 0) {
      toast({ title: "No recipients", description: "Add at least one email address.", variant: "destructive" });
      return;
    }
    if (totalMissing === 0) {
      toast({ title: "Nothing to request", description: "There are no outstanding POs for this customer.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const requestedBy = userData.user?.email || "Clews team";

      if (isBiffa) {
        // Biffa: one individual request email per site.
        for (const sg of siteGroups) {
          await sendRequestFor([sg], recipientList, requestedBy, sg.siteName);
        }
        toast({
          title: "PO requests sent",
          description: `Sent ${siteGroups.length} individual site request${siteGroups.length === 1 ? "" : "s"} to ${recipientList.length} recipient${recipientList.length === 1 ? "" : "s"}.`,
        });
      } else {
        // Other customers: a single combined request covering all sites.
        await sendRequestFor(siteGroups, recipientList, requestedBy);
        toast({
          title: "PO request sent",
          description: `Emailed ${recipientList.length} recipient${recipientList.length === 1 ? "" : "s"} for ${customerName}.`,
        });
      }
    } catch (error: any) {
      console.error("Error sending PO request:", error);
      toast({ title: "Error", description: error?.message || "Failed to send PO request.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" />
          How PO checks work
        </div>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>See, by customer and site, which jobs are still missing a PO number.</li>
          <li>Uses the same PO logic as the customer My-Portal (blank or "TBC" = no PO).</li>
          <li>Send an automated PO request email to the customer for all outstanding POs.</li>
          {isBiffa && <li>Biffa requires a separate PO per reporting period (per month).</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Period</Label>
          <Select value={lookback} onValueChange={setLookback}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOKBACK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm cursor-pointer select-none">
          <Checkbox checked={onlyCompleted} onCheckedChange={(v) => setOnlyCompleted(v === true)} />
          <span>Only completed jobs (up to today)</span>
        </label>
        {customerId && (
          <Badge variant={totalMissing > 0 ? "destructive" : "secondary"} className="text-sm mb-2">
            {totalMissing} job{totalMissing === 1 ? "" : "s"} without a PO · {gbp(totalValue)}
          </Badge>
        )}
      </div>

      {!customerId ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Building2 className="h-8 w-8" />
          <p className="font-medium text-foreground">Select a customer</p>
          <p className="text-sm">Choose a customer to see which POs are required by site.</p>
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading jobs…
        </div>
      ) : siteGroups.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="font-medium text-foreground">All jobs have a PO number</p>
          <p className="text-sm">There are no outstanding PO requests for this customer and period.</p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Send PO request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Recipients (comma separated)</Label>
                <Input
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="accounts@customer.com, orders@customer.com"
                />
              </div>
              <Button onClick={sendPORequest} disabled={sending} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isBiffa
                  ? `Send ${siteGroups.length} individual site request${siteGroups.length === 1 ? "" : "s"}`
                  : `Send PO request for ${totalMissing} outstanding job${totalMissing === 1 ? "" : "s"}`}
              </Button>
              {isBiffa && (
                <p className="text-xs text-muted-foreground">
                  Biffa receives a separate PO request email per site. Use the button on each site below to send just that site.
                </p>
              )}
            </CardContent>
          </Card>

          <Accordion type="multiple" className="space-y-3">
            {siteGroups.map((sg) => (
              <AccordionItem key={sg.siteName} value={sg.siteName} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-center gap-2 pr-3 text-left">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{sg.siteName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {sg.jobs.length} job{sg.jobs.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{sg.totalWeight.toFixed(2)} t</Badge>
                    <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/10 border-transparent">
                      PO value {gbp(sg.totalCost)}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1">
                  {sg.wasteGroups.map((wg) => {
                    const w = wg.jobs.reduce((s, j) => s + (j.weight_t || 0), 0);
                    const c = wg.jobs.reduce((s, j) => s + getCost(j), 0);
                    return (
                      <div
                        key={wg.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{wg.wasteType}</span>
                          {wg.periodLabel && (
                            <Badge variant="outline" className="text-xs">{wg.periodLabel}</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {wg.jobs.length} job{wg.jobs.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{w.toFixed(2)} t</span>
                          <span className="font-semibold text-primary">{gbp(c)}</span>
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
}
