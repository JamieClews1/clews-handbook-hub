import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import {
  addDays,
  matchPermitRows,
  normalisePostcode,
  PERMIT_STATUS_LABELS,
  type PermitApplication,
  type PermitStatus,
} from "@/lib/permits";
import { usePermitCouncils, usePermitPricing } from "@/hooks/usePermits";
import { WccPermitForm } from "@/components/permits/WccPermitForm";
import {
  buildWccPermitPdf,
  isWccArea,
  wccPdfFileName,
  wccValuesForPermit,
  type WccFormValues,
} from "@/lib/wcc-permit";

const STATUSES: PermitStatus[] = ["needed", "applied", "confirmed", "active", "rejected", "expired", "cancelled"];

export function PermitDialog({
  open,
  onOpenChange,
  permit,
  presetJob,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  permit?: PermitApplication | null;
  presetJob?: any;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pricing = [] } = usePermitPricing();
  const { data: councils = [] } = usePermitCouncils();

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobNumber, setJobNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [status, setStatus] = useState<PermitStatus>("needed");
  const [reference, setReference] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [wcc, setWcc] = useState<WccFormValues | null>(null);

  // Jobs available to attach a permit to
  const { data: jobs = [] } = useQuery({
    queryKey: ["permit_job_options"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_jobs")
        .select("id, job_number, customer_name, site_name, site_address, site_address_2, site_postcode, container_size, scheduled_date")
        .order("scheduled_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    const src = permit ?? null;
    setJobId(src?.route_one_job_id ?? presetJob?.id ?? null);
    setJobNumber(src?.job_number ?? presetJob?.job_number ?? "");
    setCustomerName(src?.customer_name ?? presetJob?.customer_name ?? "");
    setSiteAddress(src?.site_address ?? [presetJob?.site_name, presetJob?.site_address, presetJob?.site_address_2].filter(Boolean).join(", ") ?? "");
    setPostcode(src?.site_postcode ?? presetJob?.site_postcode ?? "");
    setPricingId(src?.pricing_id ?? null);
    setStatus((src?.status as PermitStatus) ?? "needed");
    setReference(src?.permit_reference ?? "");
    setStartDate(src?.start_date ?? presetJob?.scheduled_date ?? "");
    setExpiryDate(src?.expiry_date ?? "");
    setNotes(src?.notes ?? "");
  }, [open, permit, presetJob]);

  const matches = useMemo(() => matchPermitRows(postcode, pricing), [postcode, pricing]);
  const selected = matches.find((m) => m.id === pricingId) ?? null;

  // Auto-pick the cheapest matching option when nothing chosen yet
  useEffect(() => {
    if (!pricingId && matches.length > 0) setPricingId(matches[0].id);
  }, [matches, pricingId]);

  // Keep the expiry date in step with start date + permit length
  useEffect(() => {
    if (startDate && selected?.permit_days) setExpiryDate(addDays(startDate, selected.permit_days));
  }, [startDate, selected?.permit_days]);

  const council = councils.find((c) => c.area === selected?.area);

  const onPickJob = (id: string) => {
    const j = jobs.find((x: any) => x.id === id);
    setJobId(id);
    if (!j) return;
    setJobNumber(j.job_number ?? "");
    setCustomerName(j.customer_name ?? "");
    setSiteAddress([j.site_name, j.site_address, j.site_address_2].filter(Boolean).join(", "));
    setPostcode(j.site_postcode ?? "");
    if (j.scheduled_date) setStartDate(j.scheduled_date);
    setPricingId(null);
  };

  const payload = () => ({
    route_one_job_id: jobId,
    job_number: jobNumber || null,
    customer_name: customerName || null,
    site_address: siteAddress || null,
    site_postcode: normalisePostcode(postcode) || null,
    area: selected?.area ?? null,
    pricing_id: selected?.id ?? null,
    notice_required: selected?.notice_required ?? null,
    permit_days: selected?.permit_days ?? null,
    price_exc_vat: selected?.price_exc_vat ?? null,
    status,
    permit_reference: reference || null,
    start_date: startDate || null,
    expiry_date: expiryDate || null,
    council_emails: council?.application_emails ?? [],
    notes: notes || null,
  });

  const save = async (): Promise<string | null> => {
    setSaving(true);
    try {
      if (permit) {
        const { error } = await supabase.from("permit_applications").update(payload()).eq("id", permit.id);
        if (error) throw error;
        await syncJob(permit.id);
        return permit.id;
      }
      const { data, error } = await supabase.from("permit_applications").insert(payload()).select("id").single();
      if (error) throw error;
      await syncJob(data.id);
      return data.id;
    } catch (e: any) {
      toast({ title: "Could not save permit", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const syncJob = async (permitId: string) => {
    if (!jobId) return;
    await supabase
      .from("route_one_jobs")
      .update({ permit_required: true, permit_application_id: permitId })
      .eq("id", jobId);
  };

  const done = () => {
    qc.invalidateQueries({ queryKey: ["permit_applications"] });
    qc.invalidateQueries({ queryKey: ["route_one_jobs"] });
    qc.invalidateQueries({ queryKey: ["route_one_permits"] });
    onOpenChange(false);
  };

  const handleSave = async () => {
    const id = await save();
    if (id) {
      toast({ title: permit ? "Permit updated" : "Permit created" });
      done();
    }
  };

  const handleSend = async () => {
    const id = await save();
    if (!id) return;
    const { data, error } = await supabase.functions.invoke("permit-apply", { body: { permitId: id } });
    if (error || (data as any)?.error) {
      toast({
        title: "Could not send application",
        description: (data as any)?.error ?? error?.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Application sent", description: `Emailed to ${(data as any)?.to?.join(", ")}` });
    done();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{permit ? "Permit" : "New permit application"}</DialogTitle>
          <DialogDescription>The council and price are worked out from the site postcode.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">RouteOne job</Label>
            <Select value={jobId ?? ""} onValueChange={onPickJob}>
              <SelectTrigger><SelectValue placeholder="Choose a job (optional)" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {jobs.map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_number ? `#${j.job_number} — ` : ""}{j.customer_name} — {j.site_postcode || "no postcode"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Job number" value={jobNumber} onChange={setJobNumber} />
            <Field label="Customer" value={customerName} onChange={setCustomerName} />
            <div className="md:col-span-2">
              <Field label="Site address" value={siteAddress} onChange={setSiteAddress} />
            </div>
            <Field label="Site postcode" value={postcode} onChange={setPostcode} />
          </div>

          {/* Council match */}
          <div className="rounded-lg border p-3 space-y-2">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {postcode
                  ? "No standard permit rate for this postcode — quote the permit cost separately."
                  : "Enter a postcode to find the council."}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0">{matches[0].area}</Badge>
                  {council?.application_emails?.length ? (
                    <span className="text-xs text-muted-foreground">{council.application_emails.join(", ")}</span>
                  ) : (
                    <span className="text-xs text-warning">No council email set in Settings</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">When do you need it?</Label>
                  <Select value={pricingId ?? ""} onValueChange={setPricingId}>
                    <SelectTrigger><SelectValue placeholder="Choose notice period" /></SelectTrigger>
                    <SelectContent>
                      {matches.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.notice_required} — £{Number(m.price_exc_vat).toFixed(2)} exc VAT · {m.permit_days} days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PermitStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{PERMIT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Permit reference" value={reference} onChange={setReference} />
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry date</Label>
              <Input type="date" value={expiryDate ?? ""} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handleSend} disabled={saving || !council?.application_emails?.length} className="gap-1.5">
            <Send className="h-4 w-4" /> Save &amp; send application
          </Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
