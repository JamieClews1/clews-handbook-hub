import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { driverAction, fileToBase64 } from "@/lib/driver-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertTriangle,
  Award,
  Boxes,
  Camera,
  Check,
  ChevronLeft,
  ClipboardList,
  Loader2,
  LogOut,
  Plus,
  Trophy,
  Truck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const isRoroType = (n: string) => /ro\s*ro|roll\s*on/i.test(n);
const isSkipType = (n: string) => /skip|yard|yd/i.test(n);
const containerAssetType = (n: string) => (isRoroType(n) ? "roro" : "skip");

interface Reporter {
  id: string;
  name: string;
  type: "driver" | "yard";
}

interface InventoryRow {
  id: string;
  asset_number: string;
  asset_type: string;
  size?: string | null;
  condition: string | null;
  repairs_required: boolean;
  last_location: string | null;
  last_cataloged_at: string | null;
  photos?: (string | { url: string; label?: string })[] | null;
  tags?: string[] | null;
}

/** A bin only needs more info when the office has tagged it (e.g. "More photos needed"). */
const needsMoreInfo = (i: InventoryRow) =>
  (i.tags || []).some((t) => t.toLowerCase().includes("photo"));

const missingBits = (i: InventoryRow) =>
  (i.tags || []).filter((t) => t.toLowerCase().includes("photo")).join(" · ");


const numericSort = (a: InventoryRow, b: InventoryRow) =>
  a.asset_number.localeCompare(b.asset_number, undefined, {
    numeric: true,
    sensitivity: "base",
  });

interface MyReport {
  id: string;
  asset_number: string;
  asset_type: string;
  condition: string | null;
  photos: (string | { url: string; label?: string })[] | null;
  points_awarded: number | null;
  created_at: string;
}

interface PhotoItem {
  url: string;
  label?: string;
}

interface LeaderboardEntry {
  reporter_name: string;
  points: number;
  reports: number;
}

interface HubData {
  inventory: InventoryRow[];
  myReports: MyReport[];
  myPoints: number;
  leaderboard: LeaderboardEntry[];
  containerTypes: string[];
}

type Tab = "logged" | "reports" | "points";

const CONDITIONS = ["New", "Good", "Fair", "Poor"];
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

/* ─── Catalogue flow ─── */
const SkipTrackerFlow = ({
  reporter,
  inventory,
  containerTypes,
  onBack,
  onSubmitted,
  preset,
}: {
  reporter: Reporter;
  inventory: InventoryRow[];
  containerTypes: string[];
  onBack: () => void;
  onSubmitted: () => void;
  preset?: { number: string; type: string } | null;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assetType, setAssetType] = useState<"skip" | "roro">(
    preset?.type === "roro" ? "roro" : "skip",
  );
  const [containerType, setContainerType] = useState<string>("");
  const [assetNumber, setAssetNumber] = useState(preset?.number ?? "");
  const [condition, setCondition] = useState<string>("Good");
  const [repairsRequired, setRepairsRequired] = useState(false);
  const [repairNotes, setRepairNotes] = useState("");
  const [location, setLocation] = useState("");
  const [ticket, setTicket] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [pendingPhotoLabel, setPendingPhotoLabel] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefill container type only from the tapped bin's known size — otherwise the
  // driver must choose one (mandatory).
  useEffect(() => {
    setContainerType("");
    if (!containerTypes.length) return;
    if (preset?.number) {
      const bin = inventory.find(
        (i) =>
          i.asset_number.trim().toLowerCase() === preset.number.trim().toLowerCase() &&
          i.asset_type === preset.type,
      );
      const sizeMatch = bin?.size && containerTypes.some((c) => c.toLowerCase() === bin.size!.toLowerCase());
      if (sizeMatch) {
        setContainerType(bin.size!);
        setAssetType(containerAssetType(bin.size!));
      }
    }
  }, [containerTypes, preset, inventory]);


  const PHOTO_OPTIONS = ["Front", "Back", "Side 1", "Side 2"];

  // 6-month lock check against the latest catalogue for this exact bin
  const recentlyCatalogued = useMemo(() => {
    const num = assetNumber.trim().toLowerCase();
    if (!num) return null;
    const match = inventory.find(
      (i) =>
        i.asset_type === assetType && i.asset_number.trim().toLowerCase() === num,
    );
    if (!match?.last_cataloged_at) return null;
    // Bins that still need more info can always be topped up with extra photos
    if (needsMoreInfo(match)) return null;
    const ageMs = Date.now() - new Date(match.last_cataloged_at).getTime();
    return ageMs < SIX_MONTHS_MS ? match : null;
  }, [assetNumber, assetType, inventory]);

  // The exact bin being topped up (already logged, still missing info)
  const topUpTarget = useMemo(() => {
    const num = assetNumber.trim().toLowerCase();
    if (!num) return null;
    const match = inventory.find(
      (i) => i.asset_type === assetType && i.asset_number.trim().toLowerCase() === num,
    );
    return match && needsMoreInfo(match) ? match : null;
  }, [assetNumber, assetType, inventory]);

  // Bins of this type already catalogued, filtered as the driver types
  const matchingCatalogued = useMemo(() => {
    const num = assetNumber.trim().toLowerCase();
    return inventory
      .filter(
        (i) =>
          i.asset_type === assetType &&
          (!num || i.asset_number.toLowerCase().includes(num)),
      )
      .sort(numericSort)
      .slice(0, 60);
  }, [assetNumber, assetType, inventory]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const newPhotos: PhotoItem[] = [];
      for (const file of Array.from(files)) {
        const file_base64 = await fileToBase64(file);
        const { url } = await driverAction<{ url: string }>("upload_contamination_photo", {
          folder: "skip-tracker",
          file_name: file.name,
          content_type: file.type || "image/jpeg",
          file_base64,
        });
        if (url) newPhotos.push({ url, label: pendingPhotoLabel });
      }
      setPhotos((p) => [...p, ...newPhotos]);
      toast.success("Photo added");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
      setPendingPhotoLabel(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!assetNumber.trim()) {
      toast.error("Enter the skip / RoRo number");
      return;
    }
    if (!containerType) {
      toast.error("Choose a container type");
      return;
    }
    if (recentlyCatalogued) {
      toast.error("This bin was catalogued in the last 6 months");
      return;
    }
    setSubmitting(true);
    try {
      const res = await driverAction<{ points: number }>("submit_skip_tracker", {
        asset_number: assetNumber.trim(),
        asset_type: assetType,
        size: containerType,
        condition,
        repairs_required: repairsRequired,
        repair_notes: repairNotes.trim() || null,
        location: location.trim() || null,
        skiptrak_ticket: ticket.trim() || null,
        photos,
        reporter_name: reporter.name,
        reporter_driver_id: reporter.type === "driver" ? reporter.id : null,
      });
      toast.success(`Catalogued! +${res.points ?? 10} points`);
      onSubmitted();
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="p-4 border-b-4 border-emerald-500 bg-emerald-500/10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground mb-3 active:opacity-70"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-foreground">Catalogue Skip / RoRo</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Container type */}
        <div className="space-y-2">
          <Label>Container type *</Label>
          <Select
            value={containerType}
            onValueChange={(v) => {
              setContainerType(v);
              setAssetType(containerAssetType(v));
            }}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose skip / RoRo type…" />
            </SelectTrigger>
            <SelectContent>
              {containerTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Skip / RoRo number</Label>
          <Input
            value={assetNumber}
            onChange={(e) => setAssetNumber(e.target.value.toUpperCase())}
            placeholder="e.g. SK-1042"
            className="h-12 text-lg"
            autoCapitalize="characters"
          />
        </div>

        {recentlyCatalogued && (
          <div className="rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-700">
            This {assetType === "skip" ? "skip" : "RoRo"} was already catalogued on{" "}
            {format(new Date(recentlyCatalogued.last_cataloged_at!), "d MMM yyyy")}. It can't
            be reported again until 6 months have passed.
          </div>
        )}

        {topUpTarget && (
          <div className="rounded-lg border border-orange-500 bg-orange-500/10 p-3 text-sm text-orange-700">
            <p className="font-semibold">More info needed on this one — add it and earn points</p>
            <p className="text-xs mt-0.5">Still needed: {missingBits(topUpTarget)}</p>
          </div>
        )}

        {!recentlyCatalogued && matchingCatalogued.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Already catalogued — orange ones still need more photos / info
            </p>
            <div className="flex flex-wrap gap-1.5">
              {matchingCatalogued.map((i) => {
                const needs = needsMoreInfo(i);
                return (
                  <button key={i.id} type="button" onClick={() => setAssetNumber(i.asset_number)}>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "font-mono text-xs",
                        needs && "bg-orange-500 text-white hover:bg-orange-600",
                      )}
                    >
                      {i.asset_number}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}


        <div className="space-y-2">
          <Label>Condition</Label>
          <div className="grid grid-cols-4 gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={cn(
                  "h-10 rounded-lg text-xs font-semibold border transition-colors",
                  condition === c
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-background text-muted-foreground border-border",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setRepairsRequired((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors",
            repairsRequired
              ? "border-red-500 bg-red-500/10 text-red-700"
              : "border-border bg-background text-foreground",
          )}
        >
          Repairs required
          <span
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              repairsRequired ? "bg-red-500 text-white" : "bg-muted",
            )}
          >
            {repairsRequired && <Check className="w-4 h-4" />}
          </span>
        </button>

        {repairsRequired && (
          <Textarea
            value={repairNotes}
            onChange={(e) => setRepairNotes(e.target.value)}
            placeholder="Describe the repairs required…"
            rows={3}
          />
        )}

        <div className="space-y-2">
          <Label>Last known location</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Site / yard / customer"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label>Skiptrak ticket number</Label>
          <Input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            placeholder="e.g. 42718"
            className="h-12"
          />
        </div>

        {/* Photos */}
        <div className="space-y-3">
          <Label>Photos</Label>
          <div className="grid grid-cols-2 gap-3">
            {PHOTO_OPTIONS.map((label) => {
              const labelPhotos = photos
                .map((p, idx) => ({ ...p, idx }))
                .filter((p) => p.label === label);
              return (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{label}</span>
                    {labelPhotos.length > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">{labelPhotos.length}</span>
                    )}
                  </div>
                  {labelPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {labelPhotos.map((photo) => (
                        <div key={photo.idx} className="relative shrink-0">
                          <img
                            src={photo.url}
                            alt={`${label} photo`}
                            className="w-16 h-16 object-cover rounded-lg border"
                          />
                          <button
                            onClick={() =>
                              setPhotos((p) => p.filter((_, idx) => idx !== photo.idx))
                            }
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* No `capture` attribute: the Android/iOS camera *intent* returns a
                      downscaled ~1MP image. Letting the OS picker open the full camera
                      app / gallery keeps the original full-resolution photo. */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCapture}
                    multiple
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPendingPhotoLabel(label);
                      setTimeout(() => fileInputRef.current?.click(), 0);
                    }}
                    disabled={uploading}
                    className="w-full h-12 text-sm gap-2 rounded-lg border-dashed border-2"
                  >
                    {uploading && pendingPhotoLabel === label ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    {uploading && pendingPhotoLabel === label ? "Uploading…" : "Add"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !!recentlyCatalogued || !assetNumber.trim() || !containerType}
          className="w-full h-14 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          Submit Catalogue
        </Button>
      </div>
    </div>
  );
};

/* ─── Hub ─── */
const DriverSkipTracker = ({
  reporter,
  userName,
  onLogout,
  nav,
}: {
  reporter: Reporter;
  userName?: string;
  onLogout?: () => void;
  nav?: React.ReactNode;
}) => {
  const [cataloguing, setCataloguing] = useState(false);
  const [presetNumber, setPresetNumber] = useState<{ number: string; type: string } | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("logged");
  const [loggedSearch, setLoggedSearch] = useState("");
  const [loggedType, setLoggedType] = useState<"all" | "skip" | "roro">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["skip-tracker", reporter.name],
    queryFn: async (): Promise<HubData> =>
      driverAction<HubData>("skip_tracker_data", { reporter_name: reporter.name }),
  });

  if (cataloguing) {
    return (
      <SkipTrackerFlow
        reporter={reporter}
        inventory={data?.inventory ?? []}
        containerTypes={data?.containerTypes ?? []}
        preset={presetNumber}
        onBack={() => {
          setCataloguing(false);
          setPresetNumber(null);
        }}
        onSubmitted={() => {
          setCataloguing(false);
          setPresetNumber(null);
          refetch();
        }}
      />
    );
  }

  const myPoints = data?.myPoints ?? 0;
  const myReports = data?.myReports ?? [];
  const leaderboard = data?.leaderboard ?? [];
  const myRank = leaderboard.findIndex((e) => e.reporter_name === reporter.name);
  const inventory = data?.inventory ?? [];
  const q = loggedSearch.trim().toLowerCase();
  const loggedList = inventory
    .filter((i) => loggedType === "all" || i.asset_type === loggedType)
    .filter(
      (i) =>
        !q ||
        i.asset_number.toLowerCase().includes(q) ||
        (i.last_location || "").toLowerCase().includes(q),
    )
    .sort(numericSort);
  const needsInfoCount = loggedList.filter(needsMoreInfo).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-4 border-b-4 border-emerald-500 bg-emerald-500/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-6 h-6 text-emerald-500" />
              <h1 className="text-2xl font-bold text-foreground">Skip Tracker</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {userName ? `${userName} · ` : ""}Catalogue skips & RoRos to earn points
            </p>
          </div>
          {onLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-muted-foreground h-10 w-10 shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        <Card className="bg-amber-500/10 border-amber-500/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{myPoints}</p>
                <p className="text-xs text-muted-foreground">This month's points</p>
              </div>
            </div>
            {myRank >= 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">#{myRank + 1}</p>
                <p className="text-xs text-muted-foreground">Leaderboard</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-4">
        <Button
          onClick={() => {
            setPresetNumber(null);
            setCataloguing(true);
          }}
          className="w-full h-16 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-3"
        >
          <Plus className="w-6 h-6" /> Catalogue Skip / RoRo
        </Button>
      </div>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-xl">
          <button
            onClick={() => setTab("logged")}
            className={cn(
              "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
              tab === "logged" ? "bg-background shadow text-foreground" : "text-muted-foreground",
            )}
          >
            <Boxes className="w-4 h-4" /> Catalogued
          </button>
          <button
            onClick={() => setTab("reports")}
            className={cn(
              "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
              tab === "reports" ? "bg-background shadow text-foreground" : "text-muted-foreground",
            )}
          >
            <ClipboardList className="w-4 h-4" /> Mine
          </button>
          <button
            onClick={() => setTab("points")}
            className={cn(
              "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
              tab === "points" ? "bg-background shadow text-foreground" : "text-muted-foreground",
            )}
          >
            <Trophy className="w-4 h-4" /> Leaders
          </button>
        </div>
      </div>


      <div className="p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && tab === "logged" && (
          <>
            <p className="text-xs text-muted-foreground">
              These bins are already on the system — you only earn points for ones not listed
              here.
            </p>
            <Input
              value={loggedSearch}
              onChange={(e) => setLoggedSearch(e.target.value)}
              placeholder="Search bin number or location…"
              className="h-11"
            />
            <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-xl">
              {(["all", "skip", "roro"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLoggedType(t)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-semibold transition-colors",
                    loggedType === t
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {t === "all" ? "All" : t === "skip" ? "Skips" : "RoRos"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {loggedList.length} catalogued
              {needsInfoCount > 0 && (
                <span className="text-orange-600 font-semibold">
                  {" "}
                  · {needsInfoCount} need more photos / info
                </span>
              )}
            </p>
            {loggedList.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                Nothing catalogued yet.
              </p>
            ) : (
              loggedList.map((i) => {
                const needs = needsMoreInfo(i);
                return (
                  <Card
                    key={i.id}
                    className={cn(needs && "border-orange-500 bg-orange-500/10")}
                    onClick={
                      needs
                        ? () => {
                            setPresetNumber({ number: i.asset_number, type: i.asset_type });
                            setCataloguing(true);
                          }
                        : undefined
                    }
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      {needs ? (
                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                      ) : (
                        <Truck className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">
                          {i.asset_type === "roro" ? "RoRo" : "Skip"} #{i.asset_number}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[i.condition, i.last_location].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {needs && (
                          <p className="text-xs text-orange-700 font-medium truncate">
                            Needs: {missingBits(i)} — tap to add & earn points
                          </p>
                        )}
                      </div>
                      {i.last_cataloged_at && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(i.last_cataloged_at), "d MMM yy")}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}

        {!isLoading && tab === "reports" && (
          <>
            {myReports.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No catalogues yet. Tap "Catalogue Skip / RoRo" to log your first one.
              </p>
            ) : (
              myReports.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground truncate flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-500" />
                        {r.asset_type === "roro" ? "RoRo" : "Skip"} #{r.asset_number}
                      </span>
                      {typeof r.points_awarded === "number" && (
                        <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 shrink-0">
                          <Award className="w-3 h-3" /> +{r.points_awarded}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {r.condition && <span>{r.condition}</span>}
                      {r.photos && r.photos.length > 0 && (
                        <span>{r.photos.length} photo(s)</span>
                      )}
                      <span>{format(new Date(r.created_at), "d MMM yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {!isLoading && tab === "points" && (
          <>
            {leaderboard.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No points awarded yet this month.
              </p>
            ) : (
              leaderboard.map((e, i) => {
                const isMe = e.reporter_name === reporter.name;
                return (
                  <Card key={e.reporter_name} className={cn(isMe && "border-amber-500 bg-amber-500/5")}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                          i === 0
                            ? "bg-amber-400 text-white"
                            : i === 1
                            ? "bg-zinc-300 text-zinc-800"
                            : i === 2
                            ? "bg-amber-700 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {e.reporter_name}{" "}
                          {isMe && <span className="text-xs text-amber-600">(You)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.reports} catalogue(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{e.points}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
      {nav}
    </div>
  );
};

export default DriverSkipTracker;
