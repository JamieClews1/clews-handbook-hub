import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Save, BellRing, ClipboardList, CheckCircle2 } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

type PORequestGroup = {
  key: string;
  wasteType: string;
  periodLabel: string | null;
  jobs: JobRecord[];
};

interface CustomerPortalPORequestsProps {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

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

// Cost of the job, read from the raw skiptrak/midweigh "Cost" field
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

export function CustomerPortalPORequests({
  customerId,
  customerName,
  accessibleSiteIds,
}: CustomerPortalPORequestsProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobRecords, setJobRecords] = useState<JobRecord[]>([]);
  const [lookback, setLookback] = useState("6");
  // When true, only show jobs already completed (up to today) and exclude future-dated jobs
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState<string>("orders@clewsrecycling.co.uk");

  // Recipients that must always be emailed when a PO is added
  const ALWAYS_NOTIFY = ["orders@clewsrecycling.co.uk", "sharon@clewsrecycling.co.uk"];

  // Per-group PO input + saving state
  const [poInputs, setPoInputs] = useState<Record<string, string>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  // Batched changes awaiting notification
  const [pendingPOChanges, setPendingPOChanges] = useState<
    { jobId: string; siteName: string; jobNumber: string; jobDate: string; oldPONumber: string | null; newPONumber: string }[]
  >([]);
  const [notifyingPO, setNotifyingPO] = useState(false);

  // Biffa customers must supply a separate PO per reporting period (per month),
  // so a PO for May jobs cannot be reused for June jobs.
  // When the customer setting "PO can span billing periods" is on, one PO covers
  // jobs across months, so we don't split groups per reporting period.
  const [poSpansPeriods, setPoSpansPeriods] = useState(false);
  const isBiffa = customerName.toLowerCase().includes("biffa");
  const perPeriodPO = isBiffa && !poSpansPeriods;

  useEffect(() => {
    const loadNotificationEmail = async () => {
      const { data } = await supabase
        .from("customers")
        .select("po_notification_email, po_spans_periods")
        .eq("id", customerId)
        .maybeSingle();
      if (data?.po_notification_email) setNotificationEmail(data.po_notification_email);
      setPoSpansPeriods(!!data?.po_spans_periods);
    };
    loadNotificationEmail();
  }, [customerId]);

  useEffect(() => {
    const loadSites = async () => {
      if (accessibleSiteIds) {
        if (accessibleSiteIds.length === 0) {
          setSites([]);
          return;
        }
        const { data } = await supabase
          .from("customer_sites")
          .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
          .in("id", accessibleSiteIds)
          .order("site_name");
        setSites(data ?? []);
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
  }, [customerId, accessibleSiteIds]);

  const siteNameLookup = useMemo(() => {
    // Map any data_hub site alias back to the friendly site name for display
    const map = new Map<string, string>();
    for (const s of sites) {
      [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
        .filter(Boolean)
        .forEach((alias) => map.set(alias as string, s.site_name));
    }
    return map;
  }, [sites]);

  const loadJobs = useCallback(async () => {
    if (sites.length === 0) {
      setJobRecords([]);
      return;
    }
    setLoading(true);
    try {
      const startDate = format(subMonths(new Date(), parseInt(lookback, 10)), "yyyy-MM-dd");
      // Cap at today when only completed jobs are wanted; otherwise allow future-dated jobs
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
        .select("id, job_date, job_number, waste_description, container_type, ewc, weight_t, site, raw, order_number_override, source, linked_skip_job")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      if (customerFilters.size > 0) query = query.in("customer", Array.from(customerFilters));
      if (siteNames.size > 0) query = query.in("site", Array.from(siteNames));

      const { data, error } = await query;
      if (error) throw error;

      // Midweigh weighbridge tickets that are linked to a Skiptrak job are the same
      // physical movement — the Skiptrak job carries the PO, so asking for one here
      // would be duplication.
      const deduped = (data ?? []).filter((j: any) => {
        if (j.source !== "midweigh") return true;
        return !String(j.linked_skip_job ?? "").trim();
      });

      setJobRecords(deduped.filter(isMissingPO));
    } catch (error) {
      console.error("Error loading PO requests:", error);
      toast({ title: "Error", description: "Failed to load jobs.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sites, lookback, onlyCompleted, toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Group missing-PO jobs by waste type (and by billing period for Biffa)
  const groups = useMemo<PORequestGroup[]>(() => {
    // Biffa's billing period runs to the 21st of the month, so jobs dated
    // 22nd onwards belong to the following period.
    const BILLING_CUTOFF_DAY = 21;
    const billingPeriod = (jobDate: string) => {
      const d = new Date(jobDate + "T00:00:00");
      const shifted = d.getDate() > BILLING_CUTOFF_DAY ? addMonths(d, 1) : d;
      return {
        key: format(shifted, "yyyy-MM"),
        label: `${format(shifted, "MMMM yyyy")} (22 ${format(subMonths(shifted, 1), "MMM")} – 21 ${format(shifted, "MMM")})`,
      };
    };

    const map = new Map<string, PORequestGroup>();
    for (const job of jobRecords) {
      const wasteType = job.waste_description?.trim() || "Unspecified waste";
      const period = perPeriodPO && job.job_date ? billingPeriod(job.job_date) : null;
      const periodKey = period?.key ?? (job.job_date ? job.job_date.slice(0, 7) : "unknown");
      const key = perPeriodPO ? `${periodKey}__${wasteType}` : wasteType;
      let g = map.get(key);
      if (!g) {
        g = { key, wasteType, periodLabel: period?.label ?? null, jobs: [] };
        map.set(key, g);
      }
      g.jobs.push(job);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Newest period first, then waste type
      if (perPeriodPO) {
        const am = a.key.split("__")[0];
        const bm = b.key.split("__")[0];
        if (am !== bm) return bm.localeCompare(am);
      }
      return a.wasteType.localeCompare(b.wasteType);
    });
  }, [jobRecords, perPeriodPO]);


  const totalMissing = jobRecords.length;

  const applyPOToGroup = async (group: PORequestGroup) => {
    const newPO = (poInputs[group.key] || "").trim();
    if (!newPO) {
      toast({ title: "Enter a PO", description: "Please enter a PO number for this waste type.", variant: "destructive" });
      return;
    }

    setSavingGroup(group.key);
    try {
      const jobIds = group.jobs.map((j) => j.id);

      const { error: updateError } = await supabase
        .from("data_hub_jobs")
        .update({ order_number_override: newPO })
        .in("id", jobIds);
      if (updateError) throw updateError;

      // Update local state (remove now-completed jobs from the outstanding list)
      setJobRecords((prev) => prev.filter((j) => !jobIds.includes(j.id)));

      const { data: userData } = await supabase.auth.getUser();
      const changedBy = userData.user?.email || "Unknown";

      const newEntries = group.jobs.map((job) => ({
        jobId: job.id,
        siteName: (job.site && siteNameLookup.get(job.site)) || job.site || "",
        jobNumber: job.job_number,
        jobDate: job.job_date ? format(new Date(job.job_date + "T00:00:00"), "dd/MM/yyyy") : "",
        oldPONumber: getEffectivePO(job),
        newPONumber: newPO,
      }));

      // Send the notification email immediately to the required recipients.
      let emailSent = false;
      try {
        const { error: notifyError } = await supabase.functions.invoke("po-change-notification", {
          body: {
            notificationEmail,
            recipients: ALWAYS_NOTIFY,
            customerName,
            changedBy,
            changes: newEntries.map(({ siteName, jobNumber, jobDate, oldPONumber, newPONumber }) => ({
              siteName,
              jobNumber,
              jobDate,
              oldPONumber,
              newPONumber,
            })),
          },
        });
        if (notifyError) throw notifyError;
        emailSent = true;
      } catch (notifyErr) {
        console.error("Failed to send PO notification email:", notifyErr);
      }

      // Persist for audit / auto-send fallback (marked sent if the email went out).
      try {
        await supabase.from("po_pending_changes").delete().in("job_id", jobIds).eq("sent", false);
        await supabase.from("po_pending_changes").insert(
          newEntries.map((e) => ({
            customer_id: customerId,
            customer_name: customerName,
            user_id: userData.user?.id,
            changed_by: changedBy,
            notification_email: notificationEmail,
            job_id: e.jobId,
            site_name: e.siteName,
            job_number: e.jobNumber,
            job_date: e.jobDate,
            old_po_number: e.oldPONumber,
            new_po_number: e.newPONumber,
            sent: emailSent,
            sent_at: emailSent ? new Date().toISOString() : null,
          }))
        );
      } catch (persistErr) {
        console.error("Failed to persist pending PO changes:", persistErr);
      }

      setPoInputs((prev) => {
        const next = { ...prev };
        delete next[group.key];
        return next;
      });

      toast({
        title: "PO applied",
        description: emailSent
          ? `PO ${newPO} added to ${group.jobs.length} job${group.jobs.length === 1 ? "" : "s"} and the team has been emailed.`
          : `PO ${newPO} added to ${group.jobs.length} job${group.jobs.length === 1 ? "" : "s"}. The email could not be sent — please notify the team.`,
      });
    } catch (error: any) {
      console.error("Error applying PO:", error);
      toast({ title: "Error", description: error?.message || "Failed to apply PO.", variant: "destructive" });
    } finally {
      setSavingGroup(null);
    }
  };

  const notifyPOChanges = async () => {
    if (pendingPOChanges.length === 0) return;
    setNotifyingPO(true);
    try {
      const changedBy = (await supabase.auth.getUser()).data.user?.email || "Unknown";
      const { error: notifyError } = await supabase.functions.invoke("po-change-notification", {
        body: {
          notificationEmail,
          customerName,
          changedBy,
          changes: pendingPOChanges.map(({ siteName, jobNumber, jobDate, oldPONumber, newPONumber }) => ({
            siteName,
            jobNumber,
            jobDate,
            oldPONumber,
            newPONumber,
          })),
        },
      });
      if (notifyError) throw notifyError;

      const jobIds = pendingPOChanges.map((c) => c.jobId);
      if (jobIds.length > 0) {
        await supabase
          .from("po_pending_changes")
          .update({ sent: true, sent_at: new Date().toISOString() })
          .in("job_id", jobIds)
          .eq("sent", false);
      }

      toast({
        title: "Notification sent",
        description: `Notified the team of ${pendingPOChanges.length} PO${pendingPOChanges.length === 1 ? "" : "s"}.`,
      });
      setPendingPOChanges([]);
    } catch (error: any) {
      console.error("Error sending PO notification:", error);
      toast({ title: "Error", description: error?.message || "Failed to send notification.", variant: "destructive" });
    } finally {
      setNotifyingPO(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" />
          How PO numbers work
        </div>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>One PO number per waste type.</li>
          <li>A single PO can cover multiple jobs, as long as they are the same waste type.</li>
          {perPeriodPO && <li>POs must be provided per reporting period — a PO for one month cannot be reused for another.</li>}
          {isBiffa && poSpansPeriods && <li>A PO number can cover jobs beyond a single billing period.</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
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
            <Checkbox
              checked={onlyCompleted}
              onCheckedChange={(v) => setOnlyCompleted(v === true)}
            />
            <span>Only completed jobs (up to today)</span>
          </label>
        </div>
        <Badge variant={totalMissing > 0 ? "destructive" : "secondary"} className="text-sm">
          {totalMissing} job{totalMissing === 1 ? "" : "s"} without a PO
        </Badge>
      </div>

      {pendingPOChanges.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2">
            <BellRing className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {pendingPOChanges.length} PO update{pendingPOChanges.length === 1 ? "" : "s"} ready to notify
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                These will be sent automatically after 20 minutes if you don't notify sooner.
              </div>
            </div>
          </div>
          <Button size="sm" onClick={notifyPOChanges} disabled={notifyingPO} className="gap-1.5 shrink-0">
            {notifyingPO ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            Notify the team
          </Button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading jobs…
        </div>
      ) : groups.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="font-medium text-foreground">All jobs have a PO number</p>
          <p className="text-sm">There are no outstanding PO requests for this period.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {groups.map((group) => {
            const totalWeight = group.jobs.reduce((s, j) => s + (j.weight_t || 0), 0);
            const totalCost = group.jobs.reduce((s, j) => s + getCost(j), 0);
            return (
              <AccordionItem key={group.key} value={group.key} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-center gap-2 pr-3 text-left">
                    <span className="font-medium">{group.wasteType}</span>
                    {group.periodLabel && (
                      <Badge variant="outline" className="text-xs">{group.periodLabel}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{totalWeight.toFixed(2)} t</Badge>
                    <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/10 border-transparent">
                      PO value {gbp(totalCost)}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-1">
                  <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-3">
                    <div className="space-y-1.5 flex-1 min-w-[180px]">
                      <Label className="text-xs">
                        PO number for {group.wasteType}
                        {group.periodLabel ? ` — ${group.periodLabel}` : ""}
                      </Label>
                      <Input
                        value={poInputs[group.key] || ""}
                        onChange={(e) => setPoInputs((prev) => ({ ...prev, [group.key]: e.target.value }))}
                        placeholder="Enter PO number"
                        disabled={savingGroup === group.key}
                      />
                    </div>
                    <Button
                      onClick={() => applyPOToGroup(group)}
                      disabled={savingGroup === group.key || !(poInputs[group.key] || "").trim()}
                      className="gap-1.5"
                    >
                      {savingGroup === group.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Apply to {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Job No.</TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Container</TableHead>
                          <TableHead>EWC</TableHead>
                          <TableHead className="text-right">Weight (t)</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell>
                              {job.job_date ? format(new Date(job.job_date + "T00:00:00"), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{job.job_number || "-"}</TableCell>
                            <TableCell>{(job.site && siteNameLookup.get(job.site)) || job.site || "-"}</TableCell>
                            <TableCell>{job.container_type || "-"}</TableCell>
                            <TableCell>{job.ewc || "-"}</TableCell>
                            <TableCell className="text-right">
                              {job.weight_t != null ? job.weight_t.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">{gbp(getCost(job))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
