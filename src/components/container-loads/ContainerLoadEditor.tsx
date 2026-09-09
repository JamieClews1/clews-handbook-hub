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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
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

/**
 * Read the original capture time out of a JPEG's EXIF data (DateTimeOriginal /
 * DateTimeDigitized / DateTime). Falls back to the file's last-modified time,
 * then to now.
 */
async function readCaptureTime(file: File): Promise<Date> {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) throw new Error("not jpeg");
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        const start = offset + 4;
        // "Exif\0\0"
        if (view.getUint32(start) === 0x45786966) {
          const tiff = start + 6;
          const little = view.getUint16(tiff) === 0x4949;
          const get16 = (o: number) => view.getUint16(o, little);
          const get32 = (o: number) => view.getUint32(o, little);
          const readDir = (dirOffset: number): string | null => {
            const count = get16(dirOffset);
            let exifIfd: number | null = null;
            for (let i = 0; i < count; i++) {
              const entry = dirOffset + 2 + i * 12;
              const tag = get16(entry);
              if (tag === 0x8769) exifIfd = tiff + get32(entry + 8);
              if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
                const valOffset = tiff + get32(entry + 8);
                let s = "";
                for (let c = 0; c < 19; c++) s += String.fromCharCode(view.getUint8(valOffset + c));
                if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
              }
            }
            return exifIfd !== null ? readDir(exifIfd) : null;
          };
          const s = readDir(tiff + get32(tiff + 4));
          if (s) {
            const [d, t] = s.split(" ");
            const [y, mo, da] = d.split(":").map(Number);
            const [h, mi, se] = t.split(":").map(Number);
            return new Date(y, mo - 1, da, h, mi, se);
          }
        }
      }
      offset += 2 + size;
    }
  } catch {
    // Not a JPEG or no EXIF — fall through.
  }
  if (file.lastModified) return new Date(file.lastModified);
  return new Date();
}

export const formatStamp = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Burn a date/time stamp onto the bottom of a photo so it is embedded in the
// image itself (visible in the app, downloads, and the container load report).
async function stampImage(file: File, taken: Date): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);

  const stamp = formatStamp(taken);

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
  const galleryRef = useRef<HTMLInputElement>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>("other");
  const [wbLoading, setWbLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
          extra_uploads: merged.extra_uploads as any,
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
        const taken = await readCaptureTime(file);
        const stamped = await stampImage(file, taken);
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
          taken_at: taken.toISOString(),
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
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    if (!load) return;
    await supabase.storage.from(BUCKET).remove([path]);
    await persist({ photos: load.photos.filter((p) => p.path !== path) });
  };

  const uploadExtraPaperwork = async (files: FileList | null) => {
    if (!files?.length || !load) return;
    setUploading(true);
    try {
      const added = [...(load.extra_uploads ?? [])];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `container-loads/${loadId}/paperwork/extra-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        added.push({ path, url: data.publicUrl, name: file.name, uploaded_at: new Date().toISOString() });
      }
      await persist({ extra_uploads: added });
      toast({ title: "Uploaded", description: `${files.length} document(s) added.` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeExtraPaperwork = async (path: string) => {
    if (!load) return;
    await supabase.storage.from(BUCKET).remove([path]);
    await persist({ extra_uploads: (load.extra_uploads ?? []).filter((f) => f.path !== path) });
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
        // Exact filters use the indexed job lookup. Case-insensitive scans time
        // out against the full Data Hub table.
        .eq("source", "midweigh")
        .eq("job_number", ticket)
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
      // Midweigh weights are stored in KG — normalise to tonnes
      const rawWeight = job.weight_t != null ? Number(job.weight_t) : null;
      const weightT = rawWeight != null ? (rawWeight > 1000 ? rawWeight / 1000 : rawWeight) : null;
      await persist({
        wb_ticket_number: job.job_number,
        wb_location: job.site || null,
        wb_job_date: job.job_date || null,
        customer_name: job.customer || load.customer_name,
        customer_id: matchedCustomer?.id ?? load.customer_id,
        total_weight_t: weightT ?? load.total_weight_t,
        material: load.material || job.waste_description || null,
      });
      toast({
        title: "Weighbridge ticket found",
        description: `${job.customer || "Unknown customer"} · ${job.site || "No location"} · ${
          weightT != null ? weightT.toFixed(2) : "—"
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
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                  Customer reference
                </p>
                <Input
                  value={load.load_name ?? ""}
                  onChange={(e) => update({ load_name: e.target.value })}
                  onBlur={() => persist()}
                  placeholder="e.g. IW61588"
                  aria-label="Customer reference"
                  className="h-9 w-[240px] text-lg font-bold border-dashed"
                />
              </div>
              <Badge variant="outline" className={`${meta.badgeClass} self-end mb-1.5`}>
                {meta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Internal ref {load.reference} · {load.customer_name || "Unassigned customer"}
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
        defaultValue={["detail", "photos", "paperwork"]}
        className="space-y-3"
      >

        {/* DETAIL: bales, serial, container & export date */}
        <AccordionItem value="detail" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 font-semibold">
              <Package className="h-4 w-4" /> Detail
              <span className="text-xs font-normal text-muted-foreground">
                {load.bale_count} bale(s)
                {load.container_number ? ` · ${load.container_number}` : ""}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Load detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bale_count">Bale count</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="seal_number">Serial number</Label>
                  <Input
                    id="seal_number"
                    value={load.seal_number ?? ""}
                    onChange={(e) => update({ seal_number: e.target.value })}
                    onBlur={() => persist()}
                    placeholder="e.g. seal / serial no."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="container_number">Container number</Label>
                  <Input
                    id="container_number"
                    value={load.container_number ?? ""}
                    onChange={(e) => update({ container_number: e.target.value })}
                    onBlur={() => persist()}
                    placeholder="e.g. MSKU 123456-7"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export_date">Export date</Label>
                  <Input
                    id="export_date"
                    type="date"
                    value={load.export_date ?? new Date().toISOString().slice(0, 10)}
                    onChange={(e) =>
                      persist({ export_date: e.target.value || null })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Defaults to today — pick another date to override.
                  </p>
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
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />


          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loading photos required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Take a photo with the camera or upload one you already have. A date & time
                stamp is added automatically.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PHOTO_REQUIREMENTS.map((req) => {
                  const count = load.photos.filter((p) => p.category === req.key).length;
                  const done = count > 0;
                  return (
                    <div
                      key={req.key}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                        done
                          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : "border-border bg-muted/20"
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
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 gap-1.5 text-xs"
                            disabled={uploading}
                            onClick={() => {
                              setUploadCategory(req.key);
                              fileRef.current?.click();
                            }}
                          >
                            <Camera className="h-3.5 w-3.5" />
                            {done ? "Retake" : "Take photo"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs"
                            disabled={uploading}
                            onClick={() => {
                              setUploadCategory(req.key);
                              galleryRef.current?.click();
                            }}
                          >
                            <Upload className="h-3.5 w-3.5" /> Upload
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-3 text-left">
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">Other photo</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Any additional photo of the load
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 gap-1.5 text-xs"
                        disabled={uploading}
                        onClick={() => {
                          setUploadCategory("other");
                          fileRef.current?.click();
                        }}
                      >
                        <Camera className="h-3.5 w-3.5" /> Take photo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={uploading}
                        onClick={() => {
                          setUploadCategory("other");
                          galleryRef.current?.click();
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload
                      </Button>
                    </div>
                  </div>
                </div>
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
                  {load.photos.map((p, i) => {
                    const req = PHOTO_REQUIREMENTS.find((r) => r.key === p.category);
                    const when = p.taken_at || p.uploaded_at;
                    return (
                      <div key={p.path} className="space-y-1">
                        <div className="relative">
                          <button
                            type="button"
                            className="block w-full"
                            onClick={() => setViewerIndex(i)}
                          >
                            <img
                              src={p.url}
                              alt={req?.label || "Photo"}
                              loading="lazy"
                              className="w-full h-28 object-cover rounded-lg border"
                            />
                          </button>
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
                        {when && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {formatStamp(new Date(when))}
                            {p.taken_at ? "" : " (uploaded)"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full-size photo viewer */}
          <Dialog
            open={viewerIndex !== null}
            onOpenChange={(o) => !o && setViewerIndex(null)}
          >
            <DialogContent className="max-w-4xl">
              {viewerIndex !== null && load.photos[viewerIndex] && (
                <div className="space-y-3">
                  <img
                    src={load.photos[viewerIndex].url}
                    alt="Container load photo"
                    className="w-full max-h-[70vh] object-contain rounded"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">
                        {PHOTO_REQUIREMENTS.find(
                          (r) => r.key === load.photos[viewerIndex].category
                        )?.label || "Other photo"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {load.photos[viewerIndex].taken_at
                          ? `Taken ${formatStamp(new Date(load.photos[viewerIndex].taken_at!))}`
                          : load.photos[viewerIndex].uploaded_at
                          ? `Uploaded ${formatStamp(
                              new Date(load.photos[viewerIndex].uploaded_at!)
                            )}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={viewerIndex === 0}
                        onClick={() => setViewerIndex((i) => (i ?? 0) - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {viewerIndex + 1} / {load.photos.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={viewerIndex >= load.photos.length - 1}
                        onClick={() => setViewerIndex((i) => (i ?? 0) + 1)}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <a
                          href={load.photos[viewerIndex].url}
                          target="_blank"
                          rel="noreferrer"
                          download
                        >
                          <Download className="h-4 w-4 mr-1" /> Open
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Additional paperwork
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {(load.extra_uploads ?? []).length} document(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(load.extra_uploads ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add any other documents for this container — they are attached to the email too.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(load.extra_uploads ?? []).map((f) => (
                    <li
                      key={f.path}
                      className="flex items-center justify-between gap-2 rounded bg-muted/40 p-2"
                    >
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-sm truncate underline">
                        {f.name || f.path.split("/").pop()}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeExtraPaperwork(f.path)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="block">
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    uploadExtraPaperwork(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="outline" size="sm" className="gap-2 w-full sm:w-auto" disabled={uploading}>
                  <span>
                    <Upload className="h-4 w-4" /> Upload additional paperwork
                  </span>
                </Button>
              </label>
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
