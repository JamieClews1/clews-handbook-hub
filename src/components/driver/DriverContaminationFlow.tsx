import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Loader2,
  X,
  Check,
  ChevronLeft,
  PenLine,
  Award,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PricingTier,
  WasteType,
  findMatchingTier,
  calculateTierCharge,
  describeTier,
} from "@/lib/contamination-pricing";

interface DriverJobLike {
  id: string;
  job_number: string;
  customer_name: string;
  site_name: string | null;
  site_postcode: string | null;
  container_type: string | null;
  po_number: string | null;
  order_number?: string | null;
  job_date?: string | null;
  waste_description?: string | null;
  weight_t?: number | null;
  vehicle_reg?: string | null;
}

export interface ContaminationReporter {
  id: string;
  name: string;
  type: "driver" | "yard";
}

interface Props {
  /** When reporting against an existing job. Omit for a standalone report. */
  job?: DriverJobLike | null;
  reporter: ContaminationReporter;
  onBack: () => void;
  onSubmitted: (wasteTypeName: string) => void;
}

/* ── Inline touch signature pad ── */
const InlineSignature = ({
  onChange,
}: {
  onChange: (data: string | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const setup = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInk) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setup(canvas);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed rounded-xl overflow-hidden bg-white">
        <canvas
          ref={(el) => {
            if (el && el.width === 0) setup(el);
            canvasRef.current = el;
          }}
          className="w-full touch-none"
          style={{ height: "160px" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clear}
        className="gap-2"
      >
        <Eraser className="w-4 h-4" /> Clear Signature
      </Button>
    </div>
  );
};

/* ── Contamination photo capture (uploads to contamination-photos) ── */
const ContaminationPhotos = ({
  jobId,
  urls,
  onChange,
}: {
  jobId: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const next = [...urls];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${jobId}/driver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage
          .from("contamination-photos")
          .upload(path, file, { cacheControl: "3600" });
        if (error) throw error;
        const { data } = supabase.storage.from("contamination-photos").getPublicUrl(path);
        next.push(data.publicUrl);
      }
      onChange(next);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {urls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {urls.map((url) => (
            <div key={url} className="relative shrink-0">
              <img src={url} alt="Contamination" className="w-20 h-20 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        multiple
        onChange={handle}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-14 text-base gap-3 rounded-xl border-dashed border-2"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        {uploading ? "Uploading..." : "Take Contamination Photo"}
      </Button>
    </div>
  );
};

const DriverContaminationFlow = ({ job, reporter, onBack, onSubmitted }: Props) => {
  const driverId = reporter.id;
  const driverName = reporter.name;
  const standalone = !job;
  const [wasteTypeId, setWasteTypeId] = useState<string>("");
  const [pct, setPct] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signoffName, setSignoffName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Manual job details for standalone reports (no linked job)
  const [mJobNumber, setMJobNumber] = useState("");
  const [mCustomer, setMCustomer] = useState("");
  const [mSite, setMSite] = useState("");
  const [mPostcode, setMPostcode] = useState("");

  const { data: wasteTypes = [] } = useQuery({
    queryKey: ["driver-contamination-waste-types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_waste_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as WasteType[];
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["driver-contamination-tiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_pricing_tiers")
        .select("*")
        .order("display_order");
      return (data || []) as PricingTier[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["driver-contamination-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_settings")
        .select("points_per_report")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const pointsPerReport = settings?.points_per_report ?? 10;

  // Load any existing contamination report for this job so it stays + is editable on re-open
  const [editId, setEditId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const { data: existingReport, isLoading: loadingExisting } = useQuery({
    enabled: !standalone && !!job?.job_number,
    queryKey: ["driver-existing-contamination", job?.job_number, driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_queries")
        .select("*")
        .eq("job_number", job!.job_number)
        .eq("reporter_driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (prefilled || !existingReport) return;
    setEditId(existingReport.id);
    setWasteTypeId(existingReport.waste_type_id ?? "");
    setPct(existingReport.contamination_pct != null ? String(existingReport.contamination_pct) : "");
    setMinutes(existingReport.sorting_minutes != null ? String(existingReport.sorting_minutes) : "");
    setDescription(existingReport.query_reason ?? "");
    setPhotos(Array.isArray(existingReport.photos) ? (existingReport.photos as string[]) : []);
    setSignoffName(existingReport.customer_signoff_name ?? "");
    setSignature(existingReport.customer_signature ?? null);
    setPrefilled(true);
  }, [existingReport, prefilled]);


  const wasteTypeTiers = useMemo(
    () => (wasteTypeId ? tiers.filter((t) => t.waste_type_id === wasteTypeId) : []),
    [tiers, wasteTypeId],
  );

  const suggestedTier = useMemo(
    () =>
      findMatchingTier(
        wasteTypeTiers,
        pct ? parseFloat(pct) : null,
        minutes ? parseFloat(minutes) : null,
      ),
    [wasteTypeTiers, pct, minutes],
  );

  const selectedWasteName = wasteTypes.find((w) => w.id === wasteTypeId)?.name || "";

  // Resolved job/site details (from linked job or manual entry)
  const jobNumber = job?.job_number || mJobNumber.trim();
  const customerName = job?.customer_name || mCustomer.trim();
  const siteName = job?.site_name ?? (mSite.trim() || null);
  const sitePostcode = job?.site_postcode ?? (mPostcode.trim() || null);
  const photoFolder = job?.id || `standalone/${driverId}`;

  const canSubmit =
    !!wasteTypeId &&
    (!!description.trim() || !!pct || !!minutes) &&
    photos.length > 0 &&
    !!signoffName.trim() &&
    !!signature &&
    (!standalone || (!!jobNumber && !!customerName)) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(
        standalone
          ? "Please add the job/customer, waste type, a photo, the description, and customer sign-off"
          : "Please complete waste type, a photo, the description, and customer sign-off",
      );
      return;
    }
    setSubmitting(true);
    try {
      const calculated = calculateTierCharge(suggestedTier, null);
      const now = new Date().toISOString();

      const payload = {
        job_number: jobNumber,
        customer: customerName,
        site: siteName,
        postcode: sitePostcode,
        container_type: job?.container_type ?? null,
        po_number: job?.po_number ?? null,
        order_number: job?.order_number ?? null,
        job_date: job?.job_date ?? null,
        waste_description: job?.waste_description ?? null,
        weight_t: job?.weight_t ?? null,
        vehicle_reg: job?.vehicle_reg ?? null,
        source_app: reporter.type === "yard" ? "yard" : "driver",
        reporter_driver_id: reporter.type === "driver" ? driverId : null,
        reporter_name: driverName,
        reporter_type: reporter.type,
        waste_type_id: wasteTypeId,
        contamination_type: selectedWasteName,
        contamination_pct: pct ? parseFloat(pct) : null,
        sorting_minutes: minutes ? parseFloat(minutes) : null,
        pricing_tier_id: suggestedTier?.id ?? null,
        calculated_charge: calculated,
        charge_amount: calculated,
        query_reason: description.trim() || `Contamination: ${selectedWasteName}`,
        photos,
        customer_signature: signature,
        customer_signoff_name: signoffName.trim(),
        customer_signoff_at: now,
      };

      if (editId) {
        // Update the existing report for this job (keeps it editable on re-open)
        const { error: updateError } = await supabase
          .from("contamination_queries")
          .update(payload)
          .eq("id", editId);
        if (updateError) throw updateError;

        await supabase.from("contamination_activity_log").insert({
          query_id: editId,
          user_name: driverName,
          action_type: "updated",
          new_value: selectedWasteName,
          notes: "Updated via Driver App",
        });

        toast.success("Contamination report updated");
        onSubmitted(selectedWasteName);
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from("contamination_queries")
        .insert({
          ...payload,
          status: "query",
          approval_status: "pending",
          points_awarded: pointsPerReport,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      setEditId(created.id);

      // Award points to the reporter
      const { error: pointsError } = await supabase.from("contamination_points").insert({
        query_id: created.id,
        driver_id: reporter.type === "driver" ? driverId : null,
        reporter_name: driverName,
        points: pointsPerReport,
        reason: `Contamination report — Job #${jobNumber}`,
      });
      if (pointsError) console.error("Points award error:", pointsError);

      // Activity log
      await supabase.from("contamination_activity_log").insert({
        query_id: created.id,
        user_name: driverName,
        action_type: "reported",
        new_value: selectedWasteName,
        notes: "Reported via Driver App",
      });

      toast.success(`Contamination reported · +${pointsPerReport} points`);
      onSubmitted(selectedWasteName);
    } catch (err: any) {
      console.error("Contamination submit error:", err);
      toast.error(err.message || "Failed to submit contamination report");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="p-4 border-b-4 border-red-500 bg-red-500/10">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-3 active:opacity-70">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{standalone ? "Back" : "Back to Job"}</span>
        </button>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold text-foreground">Report Contamination</h1>
        </div>
        {!standalone && (
          <p className="text-sm text-muted-foreground mt-1">
            {job!.customer_name} · #{job!.job_number}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Job details (standalone only) */}
        {standalone && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Job Details</h2>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Job Number *</label>
                <Input
                  value={mJobNumber}
                  onChange={(e) => setMJobNumber(e.target.value)}
                  placeholder="e.g. 12345"
                  className="h-12 text-base rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Customer *</label>
                <Input
                  value={mCustomer}
                  onChange={(e) => setMCustomer(e.target.value)}
                  placeholder="Customer name"
                  className="h-12 text-base rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Site</label>
                  <Input
                    value={mSite}
                    onChange={(e) => setMSite(e.target.value)}
                    placeholder="Site name"
                    className="h-12 text-base rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Postcode</label>
                  <Input
                    value={mPostcode}
                    onChange={(e) => setMPostcode(e.target.value)}
                    placeholder="Postcode"
                    className="h-12 text-base rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Waste Type</h2>
            <div className="grid grid-cols-2 gap-2">
              {wasteTypes.map((wt) => (
                <Button
                  key={wt.id}
                  variant={wasteTypeId === wt.id ? "default" : "outline"}
                  onClick={() => setWasteTypeId(wasteTypeId === wt.id ? "" : wt.id)}
                  className={cn(
                    "h-12 text-sm rounded-xl justify-start",
                    wasteTypeId === wt.id && "bg-red-500 hover:bg-red-600 text-white",
                  )}
                >
                  {wt.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Severity */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Severity</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Contamination %</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="e.g. 8"
                  className="h-12 text-base rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Sorting Minutes</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="e.g. 20"
                  className="h-12 text-base rounded-xl"
                />
              </div>
            </div>
            {wasteTypeId && suggestedTier && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <span className="font-semibold">{suggestedTier.tier_name}</span>{" "}
                <span className="text-muted-foreground">({describeTier(suggestedTier)})</span>
              </div>
            )}
            {wasteTypeId && (pct || minutes) && !suggestedTier && (
              <p className="text-xs text-muted-foreground">No charge tier matched — office will review.</p>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Description</h2>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the contamination you found..."
              className="min-h-[90px] rounded-xl text-base"
            />
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4" /> Photos
            </h2>
            <ContaminationPhotos jobId={photoFolder} urls={photos} onChange={setPhotos} />
          </CardContent>
        </Card>

        {/* Customer sign-off */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <PenLine className="w-4 h-4" /> Customer Sign-Off
            </h2>
            <p className="text-xs text-muted-foreground">
              Ask the person on site to confirm they have seen the contamination.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Full Name</label>
              <Input
                value={signoffName}
                onChange={(e) => setSignoffName(e.target.value)}
                placeholder="Name of person on site"
                className="h-12 text-base rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Signature</label>
              <InlineSignature onChange={setSignature} />
            </div>
          </CardContent>
        </Card>

        {/* Points note */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
          <Award className="w-4 h-4 text-amber-500" />
          You'll earn <span className="font-bold text-foreground">{pointsPerReport} points</span> for this report
        </div>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur border-t">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-16 text-xl font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl gap-3"
        >
          {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
          Submit Contamination Report
        </Button>
      </div>
    </div>
  );
};

export default DriverContaminationFlow;
