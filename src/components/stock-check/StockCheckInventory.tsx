import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import {
  Award,
  Boxes,
  Eye,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Medal,
  Pencil,
  Plus,
  Search,
  Ticket,
  Trash2,
  Trophy,
  Wrench,
  X,
  Download,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";

interface InventoryRow {
  id: string;
  asset_number: string;
  asset_type: string;
  size: string | null;

  condition: string | null;
  repairs_required: boolean;
  repair_notes: string | null;
  photos: string[] | null;
  last_location: string | null;
  last_skiptrak_ticket: string | null;
  notes: string | null;
  last_cataloged_at: string | null;
  last_reported_by: string | null;
}

const CONDITIONS = ["Good", "Fair", "Poor", "Damaged", "Scrapped", "Yard Use"];

const conditionStyle: Record<string, string> = {
  Good: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Fair: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Poor: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Damaged: "bg-red-500/15 text-red-700 border-red-500/30",
  Scrapped: "bg-red-600 text-white border-red-700",
  "Yard Use": "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const isScrapped = (c?: string | null) => c === "Scrapped";


const emptyForm = {
  asset_number: "",
  asset_type: "skip",
  size: "",

  condition: "Good",
  repairs_required: false,
  repair_notes: "",
  last_location: "",
  last_skiptrak_ticket: "",
  notes: "",
  photos: [] as string[],
};

/* ─── Profile editor dialog ─── */
const ProfileDialog = ({
  row,
  trigger,
  onSaved,
}: {
  row?: InventoryRow;
  trigger: React.ReactNode;
  onSaved: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const { data: sizeOptions = [] } = useQuery({
    queryKey: ["skip-inventory-sizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory_sizes")
        .select("id, name, asset_type, display_order, is_active")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as { id: string; name: string; asset_type: string }[];
    },
  });


  const lookupTicketSite = async () => {
    const ticket = form.last_skiptrak_ticket.trim();
    if (!ticket) return;
    setLookingUp(true);
    try {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("site, customer, job_date")
        .eq("source", "skiptrak")
        .eq("job_number", ticket)
        .order("job_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error(`No Skiptrak job found for ticket #${ticket}`);
        return;
      }
      const site = (data.site || "").trim();
      const location = data.customer ? `${site}${site && data.customer ? " · " : ""}${data.customer}` : site;
      if (location) {
        setForm((f) => ({ ...f, last_location: location }));
        toast.success(`Location set from ticket #${ticket}`);
      } else {
        toast.error("Ticket found but no site recorded");
      }
    } catch {
      toast.error("Ticket lookup failed");
    } finally {
      setLookingUp(false);
    }
  };

  const reset = () => {
    if (row) {
      setForm({
        asset_number: row.asset_number,
        asset_type: row.asset_type,
        size: row.size || "",

        condition: row.condition || "Good",
        repairs_required: row.repairs_required,
        repair_notes: row.repair_notes || "",
        last_location: row.last_location || "",
        last_skiptrak_ticket: row.last_skiptrak_ticket || "",
        notes: row.notes || "",
        photos: row.photos || [],
      });
    } else {
      setForm(emptyForm);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `skip-tracker/staff_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage
          .from("contamination-photos")
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("contamination-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch (err) {
      toast.error("Photo upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.asset_number.trim()) {
      toast.error("Enter the skip / RoRo number");
      return;
    }
    setSaving(true);
    try {
      // Record which user logged / updated this entry
      let loggedBy: string | null = null;
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", auth.user.id)
          .maybeSingle();
        loggedBy = profile?.full_name || profile?.email || auth.user.email || null;
      }

      const payload = {
        asset_number: form.asset_number.trim(),
        asset_type: form.asset_type,
        size: form.size ? form.size : null,

        condition: form.condition,
        repairs_required: form.repairs_required,
        repair_notes: form.repair_notes.trim() || null,
        last_location: form.last_location.trim() || null,
        last_skiptrak_ticket: form.last_skiptrak_ticket.trim() || null,
        notes: form.notes.trim() || null,
        photos: form.photos,
        last_cataloged_at: new Date().toISOString(),
        ...(loggedBy ? { last_reported_by: loggedBy } : {}),
      };
      if (row) {
        const { error } = await supabase.from("skip_inventory").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("skip_inventory").insert(payload);
        if (error) throw error;
      }
      toast.success(row ? "Profile updated" : "Profile added");
      setOpen(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message?.includes("duplicate") ? "That number already exists" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? "Edit profile" : "New skip / RoRo profile"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Number</Label>
              <Input
                value={form.asset_number}
                onChange={(e) => setForm((f) => ({ ...f, asset_number: e.target.value }))}
                placeholder="e.g. SK-1042"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.asset_type}
                onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v, size: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="roro">RoRo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Size</Label>
            <Select
              value={form.size || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, size: v === "none" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {sizeOptions
                  .filter((s) => s.asset_type === form.asset_type)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>




          <div className="space-y-1.5">
            <Label>Condition</Label>
            <Select
              value={form.condition}
              onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer">Repairs required</Label>
            </div>
            <Switch
              checked={form.repairs_required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, repairs_required: v }))}
            />
          </div>

          {form.repairs_required && (
            <div className="space-y-1.5">
              <Label>Repairs needed</Label>
              <Textarea
                value={form.repair_notes}
                onChange={(e) => setForm((f) => ({ ...f, repair_notes: e.target.value }))}
                placeholder="Describe the repairs required…"
                rows={3}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Last known location</Label>
              <Input
                value={form.last_location}
                onChange={(e) => setForm((f) => ({ ...f, last_location: e.target.value }))}
                placeholder="Site / yard"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Skiptrak ticket no.</Label>
              <div className="flex gap-2">
                <Input
                  value={form.last_skiptrak_ticket}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_skiptrak_ticket: e.target.value }))
                  }
                  onBlur={lookupTicketSite}
                  placeholder="e.g. 42718"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={lookupTicketSite}
                  disabled={lookingUp || !form.last_skiptrak_ticket.trim()}
                  title="Look up location from ticket"
                >
                  {lookingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Photos</Label>
            {form.photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {form.photos.map((url, i) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }))
                      }
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
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
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Add photos
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {row ? "Save changes" : "Add profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Profile view dialog ─── */
const ViewDialog = ({ row, trigger }: { row: InventoryRow; trigger: React.ReactNode }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            #{row.asset_number}
            <Badge variant="outline" className="text-[10px] uppercase">
              {row.asset_type === "roro" ? "RoRo" : "Skip"}
            </Badge>
            {row.size && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                {row.size}
              </Badge>
            )}

          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {row.condition && (
              <Badge variant="outline" className={cn("text-xs", conditionStyle[row.condition] || "")}>
                {row.condition}
              </Badge>
            )}
            {row.repairs_required && (
              <Badge className="text-xs gap-1 bg-red-500 text-white">
                <Wrench className="h-3 w-3" /> Repairs required
              </Badge>
            )}
          </div>

          {row.repairs_required && row.repair_notes && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Repairs needed</Label>
              <p className="text-sm bg-red-500/5 border border-red-500/20 rounded-md p-2">
                {row.repair_notes}
              </p>
            </div>
          )}

          {row.photos && row.photos.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Photos</Label>
              <div className="flex gap-2 flex-wrap">
                {row.photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Last known location</Label>
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {row.last_location || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Skiptrak ticket</Label>
              <p className="flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono">{row.last_skiptrak_ticket ? `#${row.last_skiptrak_ticket}` : "—"}</span>
              </p>
            </div>
          </div>

          {row.notes && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <p className="text-sm">{row.notes}</p>
            </div>
          )}

          {row.last_cataloged_at && (
            <p className="text-[11px] text-muted-foreground pt-2 border-t">
              Last catalogued {format(new Date(row.last_cataloged_at), "d MMM yyyy")}
              {row.last_reported_by ? ` · logged by ${row.last_reported_by}` : ""}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};



/* ─── Leaderboard ─── */
const SkipTrackerLeaderboard = () => {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const start = useMemo(() => startOfMonth(monthDate).toISOString(), [monthDate]);
  const end = useMemo(() => endOfMonth(monthDate).toISOString(), [monthDate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["skip-tracker-points", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_tracker_reports")
        .select("reporter_name, points_awarded, created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      return data || [];
    },
  });

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; points: number; reports: number }>();
    for (const r of rows) {
      const key = r.reporter_name || "Unknown";
      const e = map.get(key) || { name: key, points: 0, reports: 0 };
      e.points += r.points_awarded || 0;
      e.reports += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.points - a.points);
  }, [rows]);

  const totalPoints = leaderboard.reduce((s, l) => s + l.points, 0);

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (i === 1) return <Medal className="h-5 w-5 text-zinc-400" />;
    if (i === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Skip Tracker Leaderboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthDate((d) => addMonths(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center font-medium">{format(monthDate, "MMMM yyyy")}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthDate((d) => addMonths(d, 1))}
            disabled={startOfMonth(addMonths(monthDate, 1)) > startOfMonth(new Date())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalPoints}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bins Catalogued</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{rows.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{leaderboard.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bins catalogued this month yet.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((l, i) => (
                <div
                  key={l.name}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                    <div>
                      <p className="font-medium text-sm">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.reports} catalogue{l.reports !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-base font-bold gap-1">
                    <Award className="h-4 w-4" /> {l.points}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Inventory list ─── */
const InventoryList = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "skip" | "roro">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["skip-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory")
        .select("*")
        .order("asset_number", { ascending: true });
      if (error) throw error;
      return (data || []) as InventoryRow[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["skip-inventory"] });

  const { data: conditionValues = [] } = useQuery({
    queryKey: ["skip-inventory-condition-values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory_condition_values")
        .select("asset_type, condition, value");
      if (error) throw error;
      return (data || []) as { asset_type: string; condition: string; value: number }[];
    },
  });

  const valueOf = (r: InventoryRow) =>
    Number(
      conditionValues.find(
        (v) => v.asset_type === r.asset_type && v.condition === (r.condition || ""),
      )?.value ?? 0,
    );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("skip_inventory").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Profile removed");
    refetch();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.asset_type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.asset_number.toLowerCase().includes(q) ||
        (r.last_location || "").toLowerCase().includes(q) ||
        (r.last_skiptrak_ticket || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const skips = rows.filter((r) => r.asset_type === "skip").length;
  const roros = rows.filter((r) => r.asset_type === "roro").length;
  const needRepair = rows.filter((r) => r.repairs_required).length;
  const totalValue = rows.reduce((s, r) => s + valueOf(r), 0);

  const conditionCounts = useMemo(() => {
    const counts: Record<string, number> = { Good: 0, Fair: 0, Poor: 0, Damaged: 0, Unknown: 0 };
    for (const r of rows) {
      const c = r.condition && CONDITIONS.includes(r.condition) ? r.condition : "Unknown";
      counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }, [rows]);

  const handleDownloadReport = () => {
    if (rows.length === 0) {
      toast.error("No profiles to export");
      return;
    }
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push("Skip / RoRo Inventory & Condition Report");
    lines.push(`Generated,${format(new Date(), "d MMM yyyy HH:mm")}`);
    lines.push("");
    lines.push("Summary");
    lines.push(`Total profiles,${rows.length}`);
    lines.push(`Skips,${skips}`);
    lines.push(`RoRos,${roros}`);
    lines.push(`Repairs required,${needRepair}`);
    lines.push("");
    lines.push("Condition breakdown,Count");
    [...CONDITIONS, "Unknown"].forEach((c) => {
      if (conditionCounts[c]) lines.push(`${c},${conditionCounts[c]}`);
    });
    lines.push("");
    lines.push(
      [
        "Number",
        "Type",
        "Size",

        "Condition",
        "Repairs Required",
        "Repair Notes",
        "Last Location",
        "Skiptrak Ticket",
        "Photos",
        "Notes",
        "Last Catalogued",
        "Last Reported By",
      ].join(","),
    );
    for (const r of rows) {
      lines.push(
        [
          esc(r.asset_number),
          r.asset_type === "roro" ? "RoRo" : "Skip",
          esc(r.size || ""),

          esc(r.condition || ""),
          r.repairs_required ? "Yes" : "No",
          esc(r.repair_notes || ""),
          esc(r.last_location || ""),
          esc(r.last_skiptrak_ticket || ""),
          r.photos?.length || 0,
          esc(r.notes || ""),
          r.last_cataloged_at ? format(new Date(r.last_cataloged_at), "d MMM yyyy") : "",
          esc(r.last_reported_by || ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-condition-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{rows.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skips</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{skips}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">RoRos</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{roros}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Need Repair</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-red-600">{needRepair}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Condition Report</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadReport}>
            <Download className="h-4 w-4" /> Download report
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...CONDITIONS, "Unknown"].map((c) => (
              <div
                key={c}
                className={cn(
                  "rounded-lg border p-3",
                  conditionStyle[c] || "bg-muted/40 text-muted-foreground border-border",
                )}
              >
                <p className="text-2xl font-bold">{conditionCounts[c] || 0}</p>
                <p className="text-xs font-medium">{c}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, location or ticket…"
              className="pl-9"
            />
          </div>
          <div className="flex rounded-lg border p-0.5">
            {(["all", "skip", "roro"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 h-8 rounded-md text-xs font-semibold capitalize transition-colors",
                  typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t === "roro" ? "RoRo" : t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={cn(
                "px-3 h-8 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={cn(
                "px-3 h-8 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <ProfileDialog
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New profile
              </Button>
            }
            onSaved={refetch}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Boxes className="h-12 w-12 mx-auto opacity-30 mb-3" />
          <p>No skip / RoRo profiles yet.</p>
        </div>
      ) : viewMode === "list" ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>

                  <TableHead>Condition</TableHead>
                  <TableHead>Repairs</TableHead>
                  <TableHead>Last location</TableHead>
                  <TableHead>Skiptrak ticket</TableHead>
                  <TableHead className="text-center">Photos</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                 <TableHead>Last catalogued</TableHead>
                 <TableHead>Logged by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={cn(isScrapped(r.condition) && "bg-red-500/10 text-red-700 hover:bg-red-500/15")}>
                    <TableCell className="font-semibold whitespace-nowrap">#{r.asset_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {r.asset_type === "roro" ? "RoRo" : "Skip"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{r.size || "—"}</TableCell>

                    <TableCell>
                      {r.condition ? (
                        <Badge variant="outline" className={cn("text-xs", conditionStyle[r.condition] || "")}>
                          {r.condition}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {r.repairs_required ? (
                        <div className="space-y-1">
                          <Badge className="text-xs gap-1 bg-red-500 text-white">
                            <Wrench className="h-3 w-3" /> Required
                          </Badge>
                          {r.repair_notes && (
                            <p className="text-xs text-muted-foreground truncate">{r.repair_notes}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.last_location || "—"}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">
                      {r.last_skiptrak_ticket ? `#${r.last_skiptrak_ticket}` : "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{r.photos?.length || 0}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {valueOf(r) ? `£${valueOf(r).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {r.last_cataloged_at ? format(new Date(r.last_cataloged_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {r.last_reported_by || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ViewDialog
                          row={r}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <ProfileDialog
                          row={r}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                          onSaved={refetch}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {filtered.map((r) => (
            <Card key={r.id} className={cn("overflow-hidden", isScrapped(r.condition) && "border-red-500 bg-red-500/5")}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Boxes className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-bold text-foreground truncate">
                      #{r.asset_number}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                      {r.asset_type === "roro" ? "RoRo" : "Skip"}
                    </Badge>
                    {r.size && (
                      <Badge variant="secondary" className="text-[10px] uppercase shrink-0">
                        {r.size}
                      </Badge>
                    )}

                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ViewDialog
                      row={r}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <ProfileDialog
                      row={r}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                      onSaved={refetch}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.condition && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", conditionStyle[r.condition] || "")}
                    >
                      {r.condition}
                    </Badge>
                  )}
                  {r.repairs_required && (
                    <Badge className="text-xs gap-1 bg-red-500 text-white">
                      <Wrench className="h-3 w-3" /> Repairs required
                    </Badge>
                  )}
                </div>

                {r.repairs_required && r.repair_notes && (
                  <p className="text-xs text-muted-foreground bg-red-500/5 border border-red-500/20 rounded-md p-2">
                    {r.repair_notes}
                  </p>
                )}

                {r.photos && r.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {r.photos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 text-sm">
                  {r.last_location && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{r.last_location}</span>
                    </p>
                  )}
                  {r.last_skiptrak_ticket && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Ticket className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono">Skiptrak #{r.last_skiptrak_ticket}</span>
                    </p>
                  )}
                </div>

                {r.last_cataloged_at && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t">
                    Last catalogued {format(new Date(r.last_cataloged_at), "d MMM yyyy")}
                    {r.last_reported_by ? ` · logged by ${r.last_reported_by}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const StockCheckInventory = () => {
  return (
    <Tabs defaultValue="inventory" className="space-y-6">
      <TabsList>
        <TabsTrigger value="inventory" className="gap-2">
          <Boxes className="h-4 w-4" />
          Inventory
        </TabsTrigger>
        <TabsTrigger value="leaderboard" className="gap-2">
          <Trophy className="h-4 w-4" />
          Leaderboard
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inventory">
        <InventoryList />
      </TabsContent>
      <TabsContent value="leaderboard">
        <SkipTrackerLeaderboard />
      </TabsContent>
    </Tabs>
  );
};

export default StockCheckInventory;
