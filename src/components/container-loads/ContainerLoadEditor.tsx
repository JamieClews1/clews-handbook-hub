import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Upload,
  X,
  FileText,
  Camera,
  Package,
  Loader2,
  Send,
  Scale,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContainerLoadSendDialog } from "./ContainerLoadSendDialog";
import { ContainerLoadSendHistory } from "./ContainerLoadSendHistory";
import {
  ContainerLoad,
  ContainerStatus,
  CONTAINER_STATUS_META,
  CONTAINER_STATUS_ORDER,
  PackingRow,
  PaperworkMode,
  PhotoCategory,
  PHOTO_REQUIREMENTS,
  containerLoadTitle,
  normalizeContainerLoad,
  packingTotalKg,
} from "@/lib/container-loads";
import { generateAnnex7Pdf, generatePackingSheetPdf } from "@/lib/container-paperwork";

const BUCKET = "load-photos";

// Burn a date/time stamp onto the bottom of a photo so it is embedded in the
// image itself (visible in the app, downloads, and the container load report).
async function stampImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);

  const stamp = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Scale the stamp relative to image size so it is legible on any resolution.
  const fontSize = Math.max(18, Math.round(canvas.width * 0.03));
  const pad = Math.round(fontSize * 0.5);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = "bottom";
  const textWidth = ctx.measureText(stamp).width;
  const boxH = fontSize + pad * 2;

  // Semi-transparent backing bar for contrast.
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, canvas.height - boxH, textWidth + pad * 2, boxH);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(stamp, pad, canvas.height - pad);

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.92)
  );
}

interface Props {
  loadId: string;
  onBack: () => void;
}

export const ContainerLoadEditor = ({ loadId, onBack }: Props) => {
  const { toast } = useToast();
  const [load, setLoad] = useState<ContainerLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; customer_name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>("other");
  const [wbLoading, setWbLoading] = useState(false);

  const update = (patch: Partial<ContainerLoad>) =>
    setLoad((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateAnnex = (patch: Partial<ContainerLoad["annex7"]>) =>
    setLoad((prev) => (prev ? { ...prev, annex7: { ...prev.annex7, ...patch } } : prev));

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data }, { data: custs }, { data: company }] = await Promise.all([
        supabase.from("container_loads").select("*").eq("id", loadId).single(),
        supabase
          .from("customers")
          .select("id, customer_name")
          .eq("is_container_load_customer", true)
          .order("customer_name"),
        supabase.from("company_profile").select("company_name, operational_address, telephone, email").maybeSingle(),
      ]);
      setCustomers(custs || []);
      if (data) {
        const normalized = normalizeContainerLoad(data);
        // Prefill exporter from company profile if not yet set
        if (company && !normalized.annex7.exporter_name) {
          normalized.annex7 = {
            ...normalized.annex7,
            exporter_name: company.company_name || "Clews Recycling Limited",
            exporter_address: company.operational_address || "",
            exporter_tel: company.telephone || "",
            exporter_email: company.email || "",
            country_dispatch: "United Kingdom",
          };
        }
        setLoad(normalized);
      }
      setLoading(false);
    };
    fetchAll();
  }, [loadId]);

  const persist = async (overrides?: Partial<ContainerLoad>) => {
    if (!load) return;
    const merged = { ...load, ...overrides };
    setSaving(true);
    try {
      const { error } = await supabase
        .from("container_loads")
        .update({
          status: merged.status,
          customer_id: merged.customer_id,
          customer_name: merged.customer_name,
          container_number: merged.container_number,
          seal_number: merged.seal_number,
          material: merged.material,
          ewc_code: merged.ewc_code,
          basel_code: merged.basel_code,
          bale_count: merged.bale_count,
          total_weight_t: merged.total_weight_t,
          destination_country: merged.destination_country,
          destination_facility: merged.destination_facility,
          export_date: merged.export_date || null,
          booking_reference: merged.booking_reference,
          vessel: merged.vessel,
          photos: merged.photos as any,
          packing: merged.packing as any,
          annex7: merged.annex7 as any,
          notes: merged.notes,
          operator_name: merged.operator_name,
          paperwork_mode: merged.paperwork_mode,
          annex7_upload: merged.annex7_upload as any,
          packing_upload: merged.packing_upload as any,
          load_name: merged.load_name,
          wb_ticket_number: merged.wb_ticket_number,
          wb_location: merged.wb_location,
          wb_job_date: merged.wb_job_date,
        })
        .eq("id", loadId);
      if (error) throw error;
      setLoad(merged);
      return true;
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const ok = await persist();
    if (ok) toast({ title: "Saved", description: "Container load updated." });
  };

  const handleStatusChange = async (status: ContainerStatus) => {
    update({ status });
    await persist({ status });
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("container_loads").delete().eq("id", loadId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Container load removed." });
    onBack();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length || !load) return;
    setUploading(true);
    try {
      const newPhotos = [...load.photos];
      for (const file of Array.from(files)) {
        const stamped = await stampImage(file);
        const path = `container-loads/${loadId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, stamped, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        newPhotos.push({
          path,
          url: data.publicUrl,
          caption: "",
          uploaded_at: new Date().toISOString(),
          category: uploadCategory,
        });
      }
      await persist({ photos: newPhotos });
      toast({ title: "Photos uploaded", description: `${files.length} photo(s) added.` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    if (!load) return;
    await supabase.storage.from(BUCKET).remove([path]);
    await persist({ photos: load.photos.filter((p) => p.path !== path) });
  };

  const uploadPaperwork = async (kind: "annex7" | "packing", file: File | null) => {
    if (!file || !load) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `container-loads/${loadId}/paperwork/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "application/pdf",
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const record = {
        path,
        url: data.publicUrl,
        name: file.name,
        uploaded_at: new Date().toISOString(),
      };
      await persist(
        kind === "annex7" ? { annex7_upload: record } : { packing_upload: record },
      );
      toast({ title: "Uploaded", description: `${file.name} uploaded.` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removePaperwork = async (kind: "annex7" | "packing") => {
    if (!load) return;
    const existing = kind === "annex7" ? load.annex7_upload : load.packing_upload;
    if (existing?.path) await supabase.storage.from(BUCKET).remove([existing.path]);
    await persist(kind === "annex7" ? { annex7_upload: null } : { packing_upload: null });
  };

  const setPhotoCaption = (path: string, caption: string) =>
    update({
      photos: load!.photos.map((p) => (p.path === path ? { ...p, caption } : p)),
    });

  const setPhotoCategory = async (path: string, category: PhotoCategory) => {
    const photos = load!.photos.map((p) => (p.path === path ? { ...p, category } : p));
    await persist({ photos });
  };

  // Packing rows
  const generateRowsFromCount = () => {
    if (!load) return;
    const rows: PackingRow[] = Array.from({ length: Math.max(load.bale_count, 0) }, (_, i) => {
      const existing = load.packing[i];
      return (
        existing || {
          bale_no: String(i + 1),
          material: load.material || "",
          weight_kg: null,
          notes: "",
        }
      );
    });
    update({ packing: rows });
  };

  const addRow = () =>
    update({
      packing: [
        ...load!.packing,
        { bale_no: String(load!.packing.length + 1), material: load!.material || "", weight_kg: null, notes: "" },
      ],
    });

  const updateRow = (idx: number, patch: Partial<PackingRow>) =>
    update({ packing: load!.packing.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });

  const removeRow = (idx: number) =>
    update({ packing: load!.packing.filter((_, i) => i !== idx) });

  const handleGenerate = async (kind: "annex7" | "packing") => {
    if (!load) return;
    // Save first so the document reflects the latest edits
    await persist();
    try {
      if (kind === "annex7") await generateAnnex7Pdf(load);
      else await generatePackingSheetPdf(load);
    } catch (e: any) {
      toast({ title: "Could not generate document", description: e.message, variant: "destructive" });
    }
  };

  const lookupWbTicket = async () => {
    if (!load) return;
    const ticket = (load.wb_ticket_number || "").trim();
    if (!ticket) {
      toast({ title: "Enter a WB ticket number first", variant: "destructive" });
      return;
    }
    setWbLoading(true);
    try {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("job_number, customer, site, weight_t, job_date, waste_description, vehicle_registration")
        .ilike("source", "midweigh")
        .ilike("job_number", ticket)
        .order("job_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      const job = data?.[0];
      if (!job) {
        toast({
          title: "Ticket not found",
          description: `No Midweigh record for ${ticket}.`,
          variant: "destructive",
        });
        return;
      }
      const matchedCustomer = customers.find(
        (c) => c.customer_name.trim().toLowerCase() === (job.customer || "").trim().toLowerCase(),
      );
      await persist({
        wb_ticket_number: job.job_number,
        wb_location: job.site || null,
        wb_job_date: job.job_date || null,
        customer_name: job.customer || load.customer_name,
        customer_id: matchedCustomer?.id ?? load.customer_id,
        total_weight_t: job.weight_t != null ? Number(job.weight_t) : load.total_weight_t,
        material: load.material || job.waste_description || null,
      });
      toast({
        title: "Weighbridge ticket found",
        description: `${job.customer || "Unknown customer"} · ${job.site || "No location"} · ${
          job.weight_t ?? "—"
        } t`,
      });
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    } finally {
      setWbLoading(false);
    }
  };

  if (loading || !load) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const meta = CONTAINER_STATUS_META[load.status];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Input
                value={load.load_name ?? ""}
                onChange={(e) => update({ load_name: e.target.value })}
                onBlur={() => persist()}
                placeholder={load.reference || "Name this container"}
                aria-label="Container name"
                className="h-9 w-[240px] text-lg font-bold border-dashed"
              />
              <Badge variant="outline" className={meta.badgeClass}>
                {meta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {load.reference} · {load.customer_name || "Unassigned customer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={load.status} onValueChange={(v) => handleStatusChange(v as ContainerStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTAINER_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONTAINER_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete container load?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {containerLoadTitle(load)} and its details. Uploaded photos remain in storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4" /> Weighbridge ticket
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wb_ticket">WB ticket number</Label>
              <Input
                id="wb_ticket"
                value={load.wb_ticket_number ?? ""}
                onChange={(e) => update({ wb_ticket_number: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookupWbTicket();
                }}
                placeholder="e.g. 123456"
                className="h-11 w-48 text-lg font-semibold"
              />
            </div>
            <Button onClick={lookupWbTicket} disabled={wbLoading} className="gap-2 h-11">
              {wbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Pull from Midweigh
            </Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input
                value={load.customer_name ?? ""}
                onChange={(e) => update({ customer_name: e.target.value })}
                onBlur={() => persist()}
                placeholder="Customer"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={load.wb_location ?? ""}
                onChange={(e) => update({ wb_location: e.target.value })}
                onBlur={() => persist()}
                placeholder="Site / location"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (t)</Label>
              <Input
                type="number"
                step="0.01"
                value={load.total_weight_t ?? ""}
                onChange={(e) =>
                  update({ total_weight_t: e.target.value === "" ? null : Number(e.target.value) })
                }
                onBlur={() => persist()}
              />
            </div>
          </div>
          {load.wb_job_date && (
            <p className="text-xs text-muted-foreground">
              Ticket date: {new Date(load.wb_job_date).toLocaleDateString("en-GB")}
            </p>
          )}
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        defaultValue={["bales", "photos", "paperwork"]}
        className="space-y-3"
      >

        {/* BALES & PACKING */}
        <AccordionItem value="bales" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 font-semibold">
              <Package className="h-4 w-4" /> Bales
              <span className="text-xs font-normal text-muted-foreground">
                {load.bale_count} bale(s)
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bale count</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bale_count">Number of bales</Label>
                  <Input
                    id="bale_count"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="h-14 w-40 text-2xl font-bold"
                    value={load.bale_count}
                    onChange={(e) => update({ bale_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </AccordionContent>
        </AccordionItem>

        {/* PHOTOS */}
        <AccordionItem value="photos" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 font-semibold">
              <Camera className="h-4 w-4" /> Photos
              <span className="text-xs font-normal text-muted-foreground">
                {load.photos.length} taken
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loading photos required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tap a tile to take that photo. A date & time stamp is added automatically.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PHOTO_REQUIREMENTS.map((req) => {
                  const count = load.photos.filter((p) => p.category === req.key).length;
                  const done = count > 0;
                  return (
                    <button
                      key={req.key}
                      type="button"
                      disabled={uploading}
                      onClick={() => {
                        setUploadCategory(req.key);
                        fileRef.current?.click();
                      }}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition active:scale-[0.99] ${
                        done
                          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : "border-border bg-muted/20 hover:border-primary/40"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          done
                            ? "bg-emerald-600 text-white"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {done ? (
                          <span className="text-base font-bold">✓</span>
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm leading-tight">
                          {req.label}
                          {done && count > 1 && (
                            <span className="text-xs text-muted-foreground font-normal"> · {count}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{req.hint}</div>
                        <div className="text-[11px] font-medium mt-1 text-primary">
                          {done ? "Retake / add another" : "Tap to take photo"}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setUploadCategory("other");
                    fileRef.current?.click();
                  }}
                  className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-3 text-left hover:border-primary/40"
                >
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">Other photo</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Any additional photo of the load
                    </div>
                  </div>
                </button>
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading photo…
                </div>
              )}
            </CardContent>
          </Card>

          {load.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Captured photos ({load.photos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {load.photos.map((p) => {
                    const req = PHOTO_REQUIREMENTS.find((r) => r.key === p.category);
                    return (
                      <div key={p.path} className="space-y-1">
                        <div className="relative">
                          <a href={p.url} target="_blank" rel="noreferrer">
                            <img
                              src={p.url}
                              alt={req?.label || "Photo"}
                              className="w-full h-28 object-cover rounded-lg border"
                            />
                          </a>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 opacity-90"
                            onClick={() => removePhoto(p.path)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="text-[11px] font-medium truncate">
                          {req?.label || "Other"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </AccordionContent>
        </AccordionItem>

        {/* PAPERWORK */}
        <AccordionItem value="paperwork" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4" /> Paperwork
              <span className="text-xs font-normal text-muted-foreground">
                {(load.packing_upload ? 1 : 0) + (load.annex7_upload ? 1 : 0)} of 2 uploaded
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paperwork uploads</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { kind: "packing" as const, label: "Packing list", file: load.packing_upload },
                  { kind: "annex7" as const, label: "Annex 7", file: load.annex7_upload },
                ]
              ).map(({ kind, label, file }) => (
                <div key={kind} className="rounded-lg border p-3 space-y-2">
                  <div className="font-semibold text-sm">{label}</div>
                  {file ? (
                    <div className="flex items-center justify-between gap-2 rounded bg-muted/40 p-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm truncate underline"
                      >
                        {file.name || label}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removePaperwork(kind)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No document uploaded yet.</p>
                  )}
                  <label className="block">
                    <input
                      type="file"
                      accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={(e) => {
                        uploadPaperwork(kind, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    <Button asChild variant="outline" size="sm" className="gap-2 w-full" disabled={uploading}>
                      <span>
                        <Upload className="h-4 w-4" />
                        {file ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
                      </span>
                    </Button>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </div>
          )}
        </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" /> Send container load
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setSendOpen(true)} className="gap-2">
              <Send className="h-4 w-4" /> Create email &amp; send
            </Button>
            <p className="text-sm text-muted-foreground">
              Photos and paperwork are attached automatically. orders@clewsrecycling.co.uk is always copied in.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Send history</p>
            <ContainerLoadSendHistory loadId={load.id} refreshKey={historyKey} />
          </div>
        </CardContent>
      </Card>

      <ContainerLoadSendDialog
        load={load}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={() => {
          setHistoryKey((k) => k + 1);
          persist();
        }}
      />
    </div>
  );
};
