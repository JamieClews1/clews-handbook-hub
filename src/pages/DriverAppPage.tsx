import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Truck,
  MapPin,
  Clock,
  ChevronRight,
  ChevronLeft,
  Navigation,
  Package,
  AlertTriangle,
  User,
  LogOut,
  Loader2,
  Camera,
  X,
  Check,
  Play,
  Square,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DriverContaminationFlow from "@/components/driver/DriverContaminationFlow";
import DriverContaminationsHub from "@/components/driver/DriverContaminationsHub";

/* ─── Types ───────────────────────────────────── */
type JobType = "delivery" | "exchange" | "collection" | "waste_truck" | "wasted_journey";
type JobStatus = "unassigned" | "assigned" | "in_progress" | "completed" | "query";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
};

const JOB_TYPE_COLORS: Record<JobType, { bg: string; border: string; text: string; badge: string }> = {
  delivery:       { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-700", badge: "bg-emerald-500 text-white" },
  exchange:       { bg: "bg-amber-400/10",   border: "border-amber-400",   text: "text-amber-700",   badge: "bg-amber-400 text-white" },
  collection:     { bg: "bg-orange-500/10",  border: "border-orange-500",  text: "text-orange-700",  badge: "bg-orange-500 text-white" },
  waste_truck:    { bg: "bg-blue-500/10",    border: "border-blue-500",    text: "text-blue-700",    badge: "bg-blue-500 text-white" },
  wasted_journey: { bg: "bg-red-500/10",     border: "border-red-500",     text: "text-red-700",     badge: "bg-red-500 text-white" },
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  query: "Query",
};


interface Driver {
  id: string;
  driver_name: string;
  driver_number: number | null;
  pin: string | null;
  vehicle_id: string | null;
  route_one_vehicles: { registration: string; vehicle_type: string } | null;
}

type AppRole = "driver" | "yard";
type AppView = "jobs" | "contaminations";

interface AppUser {
  id: string;
  name: string;
  role: AppRole;
  driver?: Driver;
}

interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  site_name: string | null;
  site_address: string | null;
  site_postcode: string | null;
  job_type: JobType;
  container_type: string | null;
  container_size: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  scheduled_time: string | null;
  status: JobStatus;
  notes: string | null;
  po_number: string | null;
  started_at: string | null;
  completed_at: string | null;
  driver_notes: string | null;
  contamination_type: string | null;
  contamination_notes: string | null;
}

interface JobPhoto {
  id: string;
  photo_type: string;
  file_path: string;
  file_name: string;
}

/* ─── PIN Login Screen ────────────────────────── */
const DriverLogin = ({ onLogin }: { onLogin: (user: AppUser) => void }) => {
  const [mode, setMode] = useState<AppRole>("driver");
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const numberLabel = mode === "driver" ? "Driver Number" : "Staff Number";

  const switchMode = (m: AppRole) => {
    setMode(m);
    setNumber("");
    setPin("");
    setError("");
  };

  const handleLogin = async () => {
    if (!number || !pin) {
      setError(`Enter your ${numberLabel.toLowerCase()} and PIN`);
      return;
    }
    setLoading(true);
    setError("");

    if (mode === "driver") {
      const { data, error: dbError } = await supabase
        .from("route_one_drivers")
        .select("*, route_one_vehicles(registration, vehicle_type)")
        .eq("driver_number", parseInt(number))
        .eq("pin", pin)
        .eq("is_active", true)
        .maybeSingle();

      if (dbError || !data) {
        setError("Invalid driver number or PIN");
        setLoading(false);
        return;
      }

      const user: AppUser = {
        id: data.id,
        name: data.driver_name,
        role: "driver",
        driver: data as Driver,
      };
      localStorage.setItem(
        "driver_session",
        JSON.stringify({ id: data.id, ts: Date.now(), role: "driver" }),
      );
      onLogin(user);
    } else {
      const { data, error: dbError } = await supabase
        .from("yard_staff")
        .select("id, staff_name")
        .eq("staff_number", parseInt(number))
        .eq("pin", pin)
        .eq("is_active", true)
        .maybeSingle();

      if (dbError || !data) {
        setError("Invalid staff number or PIN");
        setLoading(false);
        return;
      }

      const user: AppUser = { id: data.id, name: data.staff_name, role: "yard" };
      localStorage.setItem(
        "driver_session",
        JSON.stringify({ id: data.id, ts: Date.now(), role: "yard" }),
      );
      onLogin(user);
    }
    setLoading(false);
  };

  const handlePinButton = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/20 mb-2">
            {mode === "driver" ? (
              <Truck className="w-10 h-10 text-emerald-400" />
            ) : (
              <User className="w-10 h-10 text-emerald-400" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-white">RouteOne</h1>
          <p className="text-zinc-400 text-lg">{mode === "driver" ? "Driver Login" : "Yard Staff Login"}</p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-800 rounded-xl">
          {(["driver", "yard"] as AppRole[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "h-10 rounded-lg text-sm font-semibold transition-colors",
                mode === m ? "bg-emerald-500 text-white" : "text-zinc-400",
              )}
            >
              {m === "driver" ? "Driver" : "Yard Staff"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">{numberLabel}</label>
          <Input
            type="number"
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={`Enter ${numberLabel.toLowerCase()}`}
            className="h-14 text-xl text-center bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-3">
          <label className="text-zinc-300 text-sm font-medium">PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold",
                  pin.length > i
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600"
                )}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
            <Button
              key={key || "empty"}
              variant="ghost"
              disabled={key === ""}
              onClick={() => {
                if (key === "⌫") setPin((p) => p.slice(0, -1));
                else if (key !== "") handlePinButton(key);
              }}
              className={cn(
                "h-16 text-2xl font-semibold rounded-xl",
                key === ""
                  ? "invisible"
                  : key === "⌫"
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  : "text-white hover:bg-zinc-800 bg-zinc-800/50"
              )}
            >
              {key}
            </Button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          onClick={handleLogin}
          disabled={loading || !number || !pin}
          className="w-full h-16 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
};

/* ─── Photo Capture Component ─────────────────── */
const PhotoCapture = ({
  jobId,
  photoType,
  label,
}: {
  jobId: string;
  photoType: string;
  label: string;
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ["job-photos", jobId, photoType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_job_photos")
        .select("*")
        .eq("job_id", jobId)
        .eq("photo_type", photoType)
        .order("created_at");
      if (error) throw error;
      return (data || []) as JobPhoto[];
    },
  });

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${jobId}/${photoType}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("route-one-photos")
          .upload(fileName, file, { cacheControl: "3600" });

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("route_one_job_photos")
          .insert({
            job_id: jobId,
            photo_type: photoType,
            file_path: fileName,
            file_name: file.name,
          });

        if (dbError) throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId, photoType] });
      toast.success(`${label} photo captured`);
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: JobPhoto) => {
    await supabase.storage.from("route-one-photos").remove([photo.file_path]);
    await supabase.from("route_one_job_photos").delete().eq("id", photo.id);
    queryClient.invalidateQueries({ queryKey: ["job-photos", jobId, photoType] });
    toast.success("Photo removed");
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("route-one-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{label}</h3>
        <Badge variant="secondary" className="text-xs">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative shrink-0">
              <img
                src={getPublicUrl(photo.file_path)}
                alt={photo.file_name}
                className="w-20 h-20 object-cover rounded-lg border"
              />
              <button
                onClick={() => handleDelete(photo)}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
        multiple
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full h-14 text-base gap-3 rounded-xl border-dashed border-2"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
        {uploading ? "Uploading..." : `Take ${label} Photo`}
      </Button>
    </div>
  );
};


/* ─── Job Card ────────────────────────────────── */
const DriverJobCard = ({ job, onClick }: { job: Job; onClick: () => void }) => {
  const colors = JOB_TYPE_COLORS[job.job_type] || JOB_TYPE_COLORS.delivery;
  const isCompleted = job.status === "completed";
  const isInProgress = job.status === "in_progress";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-l-4 cursor-pointer active:scale-[0.98] transition-transform",
        colors.border,
        isCompleted ? "opacity-60" : "",
        colors.bg
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs font-bold", colors.badge)}>
                {JOB_TYPE_LABELS[job.job_type]}
              </Badge>
              {isInProgress && (
                <Badge className="bg-blue-500 text-white text-xs gap-1">
                  <Play className="w-3 h-3" /> In Progress
                </Badge>
              )}
              {isCompleted && (
                <Badge className="bg-emerald-600 text-white text-xs gap-1">
                  <Check className="w-3 h-3" /> Done
                </Badge>
              )}
              {job.status === "query" && (
                <Badge className="bg-red-500 text-white text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" /> Query
                </Badge>
              )}
              {job.scheduled_time && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {job.scheduled_time}
                </span>
              )}
            </div>

            <h3 className="font-bold text-base text-foreground truncate">{job.customer_name}</h3>

            {job.site_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{job.site_name}</span>
              </p>
            )}

            {job.container_type && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 shrink-0" />
                {job.container_type}
                {job.container_size && ` · ${job.container_size}`}
              </p>
            )}
          </div>
          <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Job Detail Screen ───────────────────────── */
const DriverJobDetail = ({
  job: initialJob,
  driverId,
  driverName,
  onBack,
  onJobUpdated,
}: {
  job: Job;
  driverId: string;
  driverName: string;
  onBack: () => void;
  onJobUpdated: () => void;
}) => {
  const queryClient = useQueryClient();
  const [job, setJob] = useState(initialJob);
  const [driverNotes, setDriverNotes] = useState(job.driver_notes || "");
  const [showContamination, setShowContamination] = useState(false);
  const [updating, setUpdating] = useState(false);

  const colors = JOB_TYPE_COLORS[job.job_type] || JOB_TYPE_COLORS.delivery;
  const isAssigned = job.status === "assigned";
  const isInProgress = job.status === "in_progress";
  const isCompleted = job.status === "completed";

  const handleNavigate = () => {
    const address = job.site_postcode || job.site_address || job.site_name || "";
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  const updateJobStatus = async (
    status: JobStatus,
    extra: Record<string, any> = {}
  ) => {
    setUpdating(true);
    try {
      const updates: Record<string, any> = { status, ...extra };
      const { error } = await supabase
        .from("route_one_jobs")
        .update(updates)
        .eq("id", job.id);
      if (error) throw error;

      setJob((prev) => ({ ...prev, status, ...extra }));
      onJobUpdated();
      toast.success(
        status === "in_progress"
          ? "Job started"
          : status === "completed"
          ? "Job completed"
          : status === "query"
          ? "Job flagged as query"
          : "Job updated"
      );
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update job");
    } finally {
      setUpdating(false);
    }
  };

  const handleStartJob = () => {
    updateJobStatus("in_progress", { started_at: new Date().toISOString() });
  };

  const handleCompleteJob = () => {
    updateJobStatus("completed", {
      completed_at: new Date().toISOString(),
      driver_notes: driverNotes.trim() || null,
    });
  };

  const handleContaminationSubmitted = (wasteTypeName: string) => {
    setShowContamination(false);
    updateJobStatus("query", {
      contamination_type: wasteTypeName,
      query_reason: `Contamination: ${wasteTypeName}`,
      driver_notes: driverNotes.trim() || null,
    });
    onBack();
  };

  const handleWastedJourney = () => {
    updateJobStatus("query", {
      query_reason: "Wasted Journey",
      driver_notes: driverNotes.trim() || null,
    });
  };

  if (showContamination) {
    return (
      <DriverContaminationFlow
        job={job}
        reporter={{ id: driverId, name: driverName, type: "driver" }}
        onBack={() => setShowContamination(false)}
        onSubmitted={handleContaminationSubmitted}
      />
    );
  }


  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className={cn("p-4 border-b-4", colors.border, colors.bg)}>
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-3 active:opacity-70">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Jobs</span>
        </button>
        <div className="flex items-center gap-3">
          <Badge className={cn("text-sm font-bold py-1 px-3", colors.badge)}>
            {JOB_TYPE_LABELS[job.job_type]}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {STATUS_LABELS[job.status] || job.status}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{job.job_number}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-2">{job.customer_name}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Location Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Location</h2>
            {job.site_name && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">{job.site_name}</p>
                  {job.site_address && <p className="text-sm text-muted-foreground">{job.site_address}</p>}
                  {job.site_postcode && <p className="text-sm text-muted-foreground font-mono">{job.site_postcode}</p>}
                </div>
              </div>
            )}
            <Button
              onClick={handleNavigate}
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-3"
              disabled={!job.site_postcode && !job.site_address && !job.site_name}
            >
              <Navigation className="w-6 h-6" />
              Navigate to Site
            </Button>
          </CardContent>
        </Card>

        {/* Job Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Job Details</h2>
            <div className="grid grid-cols-2 gap-3">
              {job.container_type && (
                <InfoItem label="Container" value={`${job.container_type}${job.container_size ? ` · ${job.container_size}` : ""}`} />
              )}
              {job.waste_type && <InfoItem label="Waste Type" value={job.waste_type} />}
              {job.ewc_code && <InfoItem label="EWC Code" value={job.ewc_code} />}
              {job.po_number && <InfoItem label="PO Number" value={job.po_number} />}
              {job.scheduled_time && <InfoItem label="Scheduled" value={job.scheduled_time} />}
            </div>
            {job.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Office Notes</p>
                <p className="text-sm text-foreground">{job.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── In Progress / Completion Section ── */}
        {(isInProgress || isCompleted) && (
          <>
            {/* Photos */}
            <Card>
              <CardContent className="p-4 space-y-5">
                <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Photos
                </h2>
                <PhotoCapture jobId={job.id} photoType="before" label="Before" />
                <div className="border-t" />
                <PhotoCapture jobId={job.id} photoType="after" label="After" />
                <div className="border-t" />
                <PhotoCapture jobId={job.id} photoType="contamination" label="Contamination" />
              </CardContent>
            </Card>

            {/* Contamination report entry point */}
            {!isCompleted && (
              <Card className="border-red-300 bg-red-500/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Found contamination?
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Log the waste type, photos, severity and capture the customer's on-site sign-off.
                  </p>
                  <Button
                    onClick={() => setShowContamination(true)}
                    className="w-full h-14 text-base font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl gap-3"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    Report Contamination
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Driver Notes */}
            {!isCompleted && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Driver Notes</h2>
                  <Textarea
                    value={driverNotes}
                    onChange={(e) => setDriverNotes(e.target.value)}
                    placeholder="Add any notes about this job..."
                    className="min-h-[80px] rounded-xl text-base"
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Completed info */}
        {isCompleted && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="w-5 h-5" />
                Job Completed
              </div>
              {job.completed_at && (
                <p className="text-sm text-muted-foreground">
                  Completed at {format(new Date(job.completed_at), "HH:mm 'on' d MMM yyyy")}
                </p>
              )}
              {job.driver_notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Driver Notes</p>
                  <p className="text-sm text-foreground">{job.driver_notes}</p>
                </div>
              )}
              {job.contamination_type && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-red-500 font-semibold text-sm mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Contamination: {job.contamination_type}
                  </div>
                  {job.contamination_notes && (
                    <p className="text-sm text-muted-foreground">{job.contamination_notes}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Action Buttons ── */}
        <div className="space-y-3">
          {isAssigned && (
            <Button
              onClick={handleStartJob}
              disabled={updating}
              className="w-full h-16 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-3"
            >
              {updating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              Start Job
            </Button>
          )}

          {isInProgress && (
            <>
              <Button
                onClick={handleCompleteJob}
                disabled={updating}
                className="w-full h-16 text-xl font-bold text-white rounded-xl gap-3 bg-emerald-500 hover:bg-emerald-600"
              >
                {updating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
                Complete Job
              </Button>

              <Button
                onClick={handleWastedJourney}
                disabled={updating}
                variant="outline"
                className="w-full h-14 text-lg font-semibold rounded-xl gap-3 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Square className="w-5 h-5" />
                Wasted Journey
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

/* ─── Skiptrak Job Card (read-only) ───────────── */
const SkiptrakDriverCard = ({ job, onClick }: { job: any; onClick: () => void }) => {
  const mt = job.movement_type?.toLowerCase().trim() || "";
  let jobType: JobType = "delivery";
  if (mt.includes("exchange") || mt.includes("swap")) jobType = "exchange";
  else if (mt.includes("collect") || mt.includes("removal") || mt.includes("uplift")) jobType = "collection";
  else if (mt.includes("waste") || mt.includes("tip")) jobType = "waste_truck";
  else if (mt.includes("wasted") || mt.includes("abortive") || mt.includes("failed")) jobType = "wasted_journey";
  else if (mt.includes("deliver")) jobType = "delivery";

  const colors = JOB_TYPE_COLORS[jobType];

  return (
    <Card
      onClick={onClick}
      className={cn("border-l-4 border-dashed cursor-pointer active:scale-[0.98] transition-transform", colors.border, colors.bg)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs font-bold", colors.badge)}>
                {job.movement_type || "Unknown"}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">Skiptrak</Badge>
            </div>
            <h3 className="font-bold text-base text-foreground truncate">{job.customer || "Unknown"}</h3>
            {job.site && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{job.site}</span>
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {job.container_type && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  {job.container_type}
                </p>
              )}
              {job.weight_t != null && job.weight_t > 0 && (
                <span className="text-xs text-muted-foreground">{job.weight_t}t</span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">#{job.job_number}</span>
          </div>
          <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Skiptrak Job Detail (read-only) ─────────── */
const SkiptrakJobDetailView = ({ job, onBack }: { job: any; onBack: () => void }) => {
  const handleNavigate = () => {
    const address = job.site || "";
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="p-4 border-b-4 border-muted bg-muted/30">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-3 active:opacity-70">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Jobs</span>
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Skiptrak</Badge>
          <span className="text-xs text-muted-foreground font-mono">#{job.job_number}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-2">{job.customer || "Unknown"}</h1>
      </div>
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Location</h2>
            {job.site && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="font-semibold text-foreground">{job.site}</p>
              </div>
            )}
            {job.tipping_location && (
              <div className="flex items-start gap-3">
                <Navigation className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipping Location</p>
                  <p className="font-semibold text-foreground">{job.tipping_location}</p>
                </div>
              </div>
            )}
            <Button
              onClick={handleNavigate}
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-3"
              disabled={!job.site}
            >
              <Navigation className="w-6 h-6" />
              Navigate to Site
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Job Details</h2>
            <div className="grid grid-cols-2 gap-3">
              {job.movement_type && <InfoItem label="Movement" value={job.movement_type} />}
              {job.container_type && <InfoItem label="Container" value={job.container_type} />}
              {job.waste_description && <InfoItem label="Waste" value={job.waste_description} />}
              {job.weight_t != null && <InfoItem label="Weight" value={`${job.weight_t}t`} />}
              {job.vehicle_registration && <InfoItem label="Vehicle" value={job.vehicle_registration} />}
              {job.job_date && <InfoItem label="Date" value={job.job_date} />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ─── Jobs Dashboard ──────────────────────────── */
const DriverDashboard = ({ driver, onLogout }: { driver: Driver; onLogout: () => void }) => {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedSkiptrakJob, setSelectedSkiptrakJob] = useState<any | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["driver-jobs", driver.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_jobs")
        .select("*")
        .eq("assigned_driver_id", driver.id)
        .eq("scheduled_date", today)
        .order("scheduled_time", { ascending: true, nullsFirst: false })
        .order("display_order");
      if (error) throw error;
      return (data || []) as Job[];
    },
    refetchInterval: 30000,
  });

  // Fetch Skiptrak jobs matched by driver name
  const { data: skiptrakJobs = [] } = useQuery({
    queryKey: ["driver-skiptrak-jobs", driver.driver_name, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("job_number, job_date, customer, site, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location")
        .eq("source", "skiptrak")
        .eq("job_date", today)
        .not("driver", "is", null)
        .order("job_date");
      if (error) throw error;
      // Filter by driver name match
      const normalized = driver.driver_name.toLowerCase().trim().replace(/[.\-_]/g, " ");
      return (data ?? []).filter((j: any) => {
        const d = (j.driver || "").toLowerCase().trim().replace(/[.\-_]/g, " ");
        return d === normalized || d.includes(normalized) || normalized.includes(d);
      });
    },
    refetchInterval: 60000,
  });

  const handleJobUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["driver-jobs", driver.id, today] });
  }, [queryClient, driver.id, today]);

  if (selectedSkiptrakJob) {
    return (
      <SkiptrakJobDetailView
        job={selectedSkiptrakJob}
        onBack={() => setSelectedSkiptrakJob(null)}
      />
    );
  }

  if (selectedJob) {
    return (
      <DriverJobDetail
        job={selectedJob}
        driverId={driver.id}
        driverName={driver.driver_name}
        onBack={() => {
          setSelectedJob(null);
          handleJobUpdated();
        }}
        onJobUpdated={handleJobUpdated}
      />
    );
  }

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const inProgressJob = jobs.find((j) => j.status === "in_progress");
  const totalJobs = jobs.length + skiptrakJobs.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-zinc-900 text-white p-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{driver.driver_name}</p>
              {driver.route_one_vehicles && (
                <p className="text-zinc-400 text-sm">
                  {driver.route_one_vehicles.registration} · {driver.route_one_vehicles.vehicle_type}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-12 w-12"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-400 text-sm">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
            <p className="text-2xl font-bold mt-1">
              {totalJobs} Job{totalJobs !== 1 ? "s" : ""} Today
            </p>
          </div>
          {jobs.length > 0 && (
            <div className="text-right">
              <p className="text-zinc-400 text-xs">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">
                {completedCount}/{jobs.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Active job banner */}
      {inProgressJob && (
        <div
          onClick={() => setSelectedJob(inProgressJob)}
          className="mx-4 mt-3 p-4 bg-blue-500 text-white rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">Job In Progress</p>
              <p className="text-sm text-blue-100">{inProgressJob.customer_name}</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6" />
        </div>
      )}

      {/* Jobs List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : totalJobs === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Truck className="w-16 h-16 text-muted-foreground mx-auto opacity-30" />
            <p className="text-xl font-semibold text-muted-foreground">No jobs assigned</p>
            <p className="text-sm text-muted-foreground">Check back later for new assignments</p>
          </div>
        ) : (
          <>
            {jobs.map((job) => (
              <DriverJobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
            ))}
            {skiptrakJobs.length > 0 && jobs.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Skiptrak Jobs</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            {skiptrakJobs.map((sj: any) => (
              <SkiptrakDriverCard key={sj.job_number} job={sj} onClick={() => setSelectedSkiptrakJob(sj)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Main Page ───────────────────────────────── */
const DriverAppPage = () => {
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("driver_session");
    if (stored) {
      try {
        const { id, ts } = JSON.parse(stored);
        if (Date.now() - ts < 14 * 60 * 60 * 1000) {
          supabase
            .from("route_one_drivers")
            .select("*, route_one_vehicles(registration, vehicle_type)")
            .eq("id", id)
            .eq("is_active", true)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setDriver(data as Driver);
              else localStorage.removeItem("driver_session");
            });
        } else {
          localStorage.removeItem("driver_session");
        }
      } catch {
        localStorage.removeItem("driver_session");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("driver_session");
    setDriver(null);
  };

  if (!driver) {
    return <DriverLogin onLogin={setDriver} />;
  }

  return <DriverDashboard driver={driver} onLogout={handleLogout} />;
};

export default DriverAppPage;
