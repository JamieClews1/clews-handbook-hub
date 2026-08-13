import { useMemo, useRef, useState, type ReactNode } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { InventorySizesSettings } from "./InventorySizesSettings";
import { InventoryValueSettings } from "./InventoryValueSettings";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import {
  Award,
  CheckCircle2,
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
  Columns3,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import { cn, compareAssetNumbers } from "@/lib/utils";

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
  value_override: number | null;
  tags: string[] | null;
  office_verified: boolean | null;
}

interface TagOption {
  id: string;
  name: string;
  colour: string;
}

const tagStyle: Record<string, string> = {
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 border-red-500/30",
  blue: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  purple: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  grey: "bg-muted text-muted-foreground border-border",
};

const useTagOptions = () =>
  useQuery({
    queryKey: ["skip-inventory-tag-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory_tags")
        .select("id, name, colour, is_active, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as TagOption[];
    },
  });

/* ─── Inline tag editor (list view cell) ─── */
const TagCell = ({
  row,
  onSaved,
}: {
  row: InventoryRow;
  onSaved: () => void;
}) => {
  const { data: tagOptions = [] } = useTagOptions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = row.tags || [];

  const toggle = async (name: string) => {
    const next = current.includes(name)
      ? current.filter((t) => t !== name)
      : [...current, name];
    setSaving(true);
    const { error } = await supabase
      .from("skip_inventory")
      .update({ tags: next })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Could not update tags");
      return;
    }
    onSaved();
  };

  const colourFor = (name: string) =>
    tagStyle[tagOptions.find((t) => t.name === name)?.colour || "amber"] || tagStyle.amber;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left rounded-md px-1 py-0.5 hover:bg-muted transition-colors"
        >
          {current.length ? (
            <div className="flex flex-wrap gap-1">
              {current.map((t) => (
                <Badge key={t} variant="outline" className={cn("text-[10px]", colourFor(t))}>
                  {t}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">+ Tag</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Tags</p>
        {tagOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">No tags set up yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((t) => {
            const active = current.includes(t.name);
            return (
              <button
                key={t.id}
                type="button"
                disabled={saving}
                onClick={() => toggle(t.name)}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-50",
                  active
                    ? tagStyle[t.colour] || tagStyle.amber
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const CONDITIONS = ["New", "Good", "Fair", "Poor", "Scrapped", "Yard Use"];

const conditionStyle: Record<string, string> = {
  New: "bg-lime-500/15 text-lime-700 border-lime-500/30",
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
  value_override: "",
  tags: [] as string[],
  office_verified: false,
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
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const { data: tagOptions = [], refetch: refetchTags } = useTagOptions();

  const toggleTag = (name: string) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));

  const createTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    setAddingTag(true);
    try {
      const { error } = await supabase
        .from("skip_inventory_tags")
        .insert({ name, display_order: tagOptions.length + 1 });
      if (error && !error.message.includes("duplicate")) throw error;
      await refetchTags();
      setForm((f) => (f.tags.includes(name) ? f : { ...f, tags: [...f.tags, name] }));
      setNewTag("");
    } catch {
      toast.error("Could not add tag");
    } finally {
      setAddingTag(false);
    }
  };

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
        value_override:
          row.value_override === null || row.value_override === undefined
            ? ""
            : String(row.value_override),
        tags: row.tags || [],
        office_verified: !!row.office_verified,
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
        value_override:
          form.value_override.trim() === "" ? null : Number(form.value_override),
        tags: form.tags,
        office_verified: form.office_verified,
        last_cataloged_at: new Date().toISOString(),
        // Keep the original logger — only stamp the name when creating a new record
        ...(!row && loggedBy ? { last_reported_by: loggedBy } : {}),
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, asset_number: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. SK-1042"
                autoCapitalize="characters"
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
          <div className="space-y-1.5">
            <Label>Value (£)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="1"
              value={form.value_override}
              onChange={(e) => setForm((f) => ({ ...f, value_override: e.target.value }))}
              placeholder="Leave blank to use condition value"
            />
            <p className="text-xs text-muted-foreground">
              Overrides the default value set for this condition in settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tagOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No tags yet — add one below.</p>
              )}
              {tagOptions.map((t) => {
                const active = form.tags.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={cn(
                      "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                      active
                        ? tagStyle[t.colour] || tagStyle.amber
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={createTag} disabled={addingTag}>
                {addingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer">Office verified</Label>
            </div>
            <Switch
              checked={form.office_verified}
              onCheckedChange={(v) => setForm((f) => ({ ...f, office_verified: v }))}
            />
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
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                    </a>
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
            {(row.tags || []).map((t) => (
              <Badge key={t} variant="outline" className={cn("text-xs", tagStyle.amber)}>
                {t}
              </Badge>
            ))}
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

/* ─── Column visibility ─── */
const COLUMN_PREF_KEY = "skip-inventory-visible-columns";
const COLUMN_DEFS = [
  { key: "number", label: "Number", locked: true },
  { key: "type", label: "Type" },
  { key: "size", label: "Size" },
  { key: "condition", label: "Condition" },
  { key: "tags", label: "Tags" },
  { key: "verified", label: "Office verified" },
  { key: "repairs", label: "Repairs" },
  { key: "location", label: "Last location" },
  { key: "ticket", label: "Skiptrak ticket" },
  { key: "photos", label: "Photos" },
  { key: "value", label: "Value" },
  { key: "cataloged", label: "Last catalogued" },
  { key: "loggedBy", label: "Logged by" },
  { key: "actions", label: "Actions", locked: true },
] as const;
const DEFAULT_COLUMNS: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, true]),
);

/* ─── Inventory list ─── */
const InventoryList = () => {

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "skip" | "roro">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const { data: tagOptions = [] } = useTagOptions();
  const tagColour = (name: string) =>
    tagStyle[tagOptions.find((t) => t.name === name)?.colour || "amber"] || tagStyle.amber;
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_PREF_KEY);
      if (saved) return { ...DEFAULT_COLUMNS, ...JSON.parse(saved) };
    } catch {
      /* ignore */
    }
    return DEFAULT_COLUMNS;
  });

  const toggleCol = (key: string) =>
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const resetCols = () => {
    setVisibleCols(DEFAULT_COLUMNS);
    try {
      localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify(DEFAULT_COLUMNS));
    } catch {
      /* ignore */
    }
  };

  const shownCount = COLUMN_DEFS.filter((c) => visibleCols[c.key]).length;

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: "number",
    dir: "asc",
  });

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const sortRows = (data: InventoryRow[]) => {
    const { key, dir } = sort;
    const sorted = [...data];
    const mult = dir === "asc" ? 1 : -1;

    const num = (s?: string | null) => {
      if (!s) return 0;
      const m = s.match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    };
    const alpha = (s?: string | null) => (s || "").toLowerCase();

    sorted.sort((a, b) => {
      switch (key) {
        case "number": {
          return compareAssetNumbers(a.asset_number || "", b.asset_number || "") * mult;
        }
        case "type":
          return (alpha(a.asset_type).localeCompare(alpha(b.asset_type))) * mult;
        case "size":
          return (alpha(a.size).localeCompare(alpha(b.size))) * mult;
        case "condition":
          return (alpha(a.condition).localeCompare(alpha(b.condition))) * mult;
        case "tags": {
          const aT = (a.tags || []).join(", ").toLowerCase();
          const bT = (b.tags || []).join(", ").toLowerCase();
          return aT.localeCompare(bT) * mult;
        }
        case "verified":
          return ((a.office_verified ? 1 : 0) - (b.office_verified ? 1 : 0)) * mult;
        case "repairs": {
          const aR = a.repairs_required ? 1 : 0;
          const bR = b.repairs_required ? 1 : 0;
          if (aR !== bR) return (aR - bR) * mult;
          return alpha(a.repair_notes).localeCompare(alpha(b.repair_notes)) * mult;
        }
        case "location":
          return alpha(a.last_location).localeCompare(alpha(b.last_location)) * mult;
        case "ticket":
          return alpha(a.last_skiptrak_ticket).localeCompare(alpha(b.last_skiptrak_ticket)) * mult;
        case "photos":
          return ((a.photos?.length || 0) - (b.photos?.length || 0)) * mult;
        case "value":
          return (valueOf(a) - valueOf(b)) * mult;
        case "cataloged": {
          const aD = a.last_cataloged_at ? new Date(a.last_cataloged_at).getTime() : 0;
          const bD = b.last_cataloged_at ? new Date(b.last_cataloged_at).getTime() : 0;
          return (aD - bD) * mult;
        }
        case "loggedBy":
          return alpha(a.last_reported_by).localeCompare(alpha(b.last_reported_by)) * mult;
        default:
          return 0;
      }
    });
    return sorted;
  };

  const {
    data: rows = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["skip-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory")
        .select("*")
        .order("asset_number", { ascending: true });
      if (error) throw error;
      // Photos can be stored either as plain URL strings (office uploads) or as
      // { url, label } objects (driver app captures) — normalise to URL strings.
      return ((data || []) as any[]).map((r) => ({
        ...r,
        photos: Array.isArray(r.photos)
          ? r.photos
              .map((p: any) => (typeof p === "string" ? p : p?.url))
              .filter(Boolean)
          : [],
      })) as InventoryRow[];
    },
  });

  const { data: conditionValues = [] } = useQuery({
    queryKey: ["skip-inventory-condition-values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skip_inventory_condition_values")
        .select("asset_type, condition, value, size_group, sizes");
      if (error) throw error;
      return (data || []) as {
        asset_type: string;
        condition: string;
        value: number;
        size_group: string | null;
        sizes: string[] | null;
      }[];
    },
  });

  const { data: shareLinks = [] } = useQuery({
    queryKey: ["inventory-share-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_share_links")
        .select("id, token, label, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as { id: string; token: string; label: string | null; is_active: boolean }[];
    },
  });

  const valueOf = (r: InventoryRow) => {
    if (r.value_override !== null && r.value_override !== undefined) {
      return Number(r.value_override);
    }
    const matches = conditionValues.filter(
      (v) => v.asset_type === r.asset_type && v.condition === (r.condition || ""),
    );
    const bySize = r.size
      ? matches.find((v) => (v.sizes || []).includes(r.size as string))
      : undefined;
    const fallback = matches.find((v) => !v.size_group);
    return Number((bySize ?? fallback)?.value ?? 0);
  };

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
      if (tagFilter !== "all" && !(r.tags || []).includes(tagFilter)) return false;
      if (!q) return true;
      return (
        r.asset_number.toLowerCase().includes(q) ||
        (r.last_location || "").toLowerCase().includes(q) ||
        (r.last_skiptrak_ticket || "").toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [rows, search, typeFilter, tagFilter]);

  const sortedRows = useMemo(
    () => sortRows(filtered),
    [filtered, sort.key, sort.dir, conditionValues],
  );

  const skips = rows.filter((r) => r.asset_type === "skip").length;
  const roros = rows.filter(
    (r) => r.asset_type === "roro" && r.condition !== "Scrapped" && r.condition !== "Yard Use",
  ).length;
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

  const SortHeader = ({
    colKey,
    children,
    className,
    align = "left",
  }: {
    colKey: string;
    children: ReactNode;
    className?: string;
    align?: "left" | "center" | "right";
  }) => {
    const active = sort.key === colKey;
    const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        className={cn(
          "cursor-pointer select-none whitespace-nowrap",
          align === "center" && "text-center",
          align === "right" && "text-right",
          className,
        )}
        onClick={() => handleSort(colKey)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <Icon className={cn("h-3.5 w-3.5", active ? "text-foreground" : "text-muted-foreground/60")} />
        </span>
      </TableHead>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">£{totalValue.toLocaleString()}</span>
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
          {tagOptions.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All tags</SelectItem>
                {tagOptions.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "list" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Columns3 className="h-4 w-4" /> Columns
                  <Badge variant="secondary" className="text-[10px]">
                    {shownCount}/{COLUMN_DEFS.length}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_DEFS.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!!visibleCols[c.key]}
                    disabled={"locked" in c && c.locked}
                    onCheckedChange={() => toggleCol(c.key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <button
                  onClick={resetCols}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent"
                >
                  Show all columns
                </button>
              </DropdownMenuContent>
          </DropdownMenu>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>

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

        {shareLinks.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" className="gap-2" disabled>
                <ExternalLink className="h-4 w-4" /> External view
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Create an active share link in Inventory Settings to enable the external view.</p>
            </TooltipContent>
          </Tooltip>
        ) : shareLinks.length === 1 ? (
          <Button variant="outline" className="gap-2" asChild>
            <a href={`/inventory/${shareLinks[0].token}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> External view
            </a>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" /> External view
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              <DropdownMenuLabel>Choose external link</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {shareLinks.map((l) => (
                <a
                  key={l.id}
                  href={`/inventory/${l.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  {l.label || "External inventory view"}
                </a>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Settings
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Inventory Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <InventorySizesSettings />
                <InventoryValueSettings />
              </div>
            </DialogContent>
          </Dialog>
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
        <Card className="overflow-hidden">
          <div className="w-full max-w-full overflow-x-auto">
            <Table style={{ minWidth: `${Math.max(600, shownCount * 130)}px` }}>
              <TableHeader>
                <TableRow>
                  <SortHeader colKey="number">Number</SortHeader>
                  {visibleCols.type && <SortHeader colKey="type">Type</SortHeader>}
                  {visibleCols.size && <SortHeader colKey="size">Size</SortHeader>}
                  {visibleCols.condition && <SortHeader colKey="condition">Condition</SortHeader>}
                  {visibleCols.tags && <SortHeader colKey="tags">Tags</SortHeader>}
                  {visibleCols.verified && (
                    <SortHeader colKey="verified" align="center">Office verified</SortHeader>
                  )}
                  {visibleCols.repairs && <SortHeader colKey="repairs">Repairs</SortHeader>}
                  {visibleCols.location && <SortHeader colKey="location">Last location</SortHeader>}
                  {visibleCols.ticket && <SortHeader colKey="ticket">Skiptrak ticket</SortHeader>}
                  {visibleCols.photos && (
                    <SortHeader colKey="photos" align="center">Photos</SortHeader>
                  )}
                  {visibleCols.value && (
                    <SortHeader colKey="value" align="right">Value</SortHeader>
                  )}
                  {visibleCols.cataloged && <SortHeader colKey="cataloged">Last catalogued</SortHeader>}
                  {visibleCols.loggedBy && <SortHeader colKey="loggedBy">Logged by</SortHeader>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((r) => (
                  <TableRow key={r.id} className={cn(isScrapped(r.condition) && "bg-red-500/10 text-red-700 hover:bg-red-500/15")}>
                    <TableCell className="font-semibold whitespace-nowrap">#{r.asset_number}</TableCell>
                    {visibleCols.type && (
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {r.asset_type === "roro" ? "RoRo" : "Skip"}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleCols.size && (
                      <TableCell className="whitespace-nowrap text-sm">{r.size || "—"}</TableCell>
                    )}
                    {visibleCols.condition && (
                      <TableCell>
                        {r.condition ? (
                          <Badge variant="outline" className={cn("text-xs", conditionStyle[r.condition] || "")}>
                            {r.condition}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.tags && (
                      <TableCell className="max-w-[240px]">
                        <TagCell row={r} onSaved={refetch} />
                      </TableCell>
                    )}
                    {visibleCols.verified && (
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!r.office_verified}
                          aria-label={`Office verified for ${r.asset_number}`}
                          onCheckedChange={async (v) => {
                            const { error } = await supabase
                              .from("skip_inventory")
                              .update({ office_verified: !!v })
                              .eq("id", r.id);
                            if (error) {
                              toast.error("Could not update verification");
                              return;
                            }
                            refetch();
                          }}
                        />
                      </TableCell>
                    )}
                    {visibleCols.repairs && (
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
                    )}
                    {visibleCols.location && (
                      <TableCell className="max-w-[220px] truncate">{r.last_location || "—"}</TableCell>
                    )}
                    {visibleCols.ticket && (
                      <TableCell className="font-mono whitespace-nowrap">
                        {r.last_skiptrak_ticket ? `#${r.last_skiptrak_ticket}` : "—"}
                      </TableCell>
                    )}
                    {visibleCols.photos && (
                      <TableCell className="text-center tabular-nums">{r.photos?.length || 0}</TableCell>
                    )}
                    {visibleCols.value && (
                      <TableCell className="text-right tabular-nums font-medium">
                        {valueOf(r) ? `£${valueOf(r).toLocaleString()}` : "—"}
                      </TableCell>
                    )}
                    {visibleCols.cataloged && (
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {r.last_cataloged_at ? format(new Date(r.last_cataloged_at), "d MMM yyyy") : "—"}
                      </TableCell>
                    )}
                    {visibleCols.loggedBy && (
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {r.last_reported_by || "—"}
                      </TableCell>
                    )}

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
                  {(r.tags || []).map((t) => (
                    <Badge key={t} variant="outline" className={cn("text-xs", tagColour(t))}>
                      {t}
                    </Badge>
                  ))}
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
