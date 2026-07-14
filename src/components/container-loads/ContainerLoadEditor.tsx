import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContainerLoadSendDialog } from "./ContainerLoadSendDialog";
import {
  ContainerLoad,
  ContainerStatus,
  CONTAINER_STATUS_META,
  CONTAINER_STATUS_ORDER,
  PackingRow,
  PaperworkMode,
  PhotoCategory,
  PHOTO_REQUIREMENTS,
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
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>("other");

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
              <h2 className="text-xl font-bold">{load.reference}</h2>
              <Badge variant="outline" className={meta.badgeClass}>
                {meta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {load.customer_name || "Unassigned customer"}
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
          <Button
            variant="secondary"
            onClick={() => setSendOpen(true)}
            className="gap-2"
          >
            <Send className="h-4 w-4" /> Send
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
                  This permanently deletes {load.reference} and its details. Uploaded photos remain in storage.
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

      <Tabs defaultValue="bales" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bales" className="gap-1">
            <Package className="h-4 w-4" /> Bales
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1">
            <Camera className="h-4 w-4" /> Photos
          </TabsTrigger>
          <TabsTrigger value="paperwork" className="gap-1">
            <FileText className="h-4 w-4" /> Paperwork
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* BALES & PACKING */}
        <TabsContent value="bales" className="space-y-4">
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
                <Button variant="outline" className="gap-2 mb-1" onClick={generateRowsFromCount}>
                  <Plus className="h-4 w-4" /> Build packing rows
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Optionally list each bale below for the packing sheet. Total listed:{" "}
                {load.packing.length} bales · {packingTotalKg(load.packing).toLocaleString()} kg
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Packing breakdown</CardTitle>
              <Button variant="outline" size="sm" className="gap-2" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add bale
              </Button>
            </CardHeader>
            <CardContent>
              {load.packing.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No bale lines yet — set a bale count and tap “Build packing rows”, or add bales manually.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-[60px_1fr_120px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                    <span>Bale #</span>
                    <span>Material</span>
                    <span>Weight (kg)</span>
                    <span>Notes</span>
                    <span></span>
                  </div>
                  {load.packing.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 sm:grid-cols-[60px_1fr_120px_1fr_40px] gap-2"
                    >
                      <Input
                        value={row.bale_no}
                        onChange={(e) => updateRow(idx, { bale_no: e.target.value })}
                        placeholder="#"
                      />
                      <Input
                        value={row.material}
                        onChange={(e) => updateRow(idx, { material: e.target.value })}
                        placeholder="Material"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={row.weight_kg ?? ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            weight_kg: e.target.value === "" ? null : parseFloat(e.target.value),
                          })
                        }
                        placeholder="kg"
                      />
                      <Input
                        value={row.notes ?? ""}
                        onChange={(e) => updateRow(idx, { notes: e.target.value })}
                        placeholder="Notes"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PHOTOS */}
        <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos of load & container</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Add photos
              </Button>

              {load.photos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No photos yet. Capture the loaded container and bales.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {load.photos.map((p) => (
                    <div key={p.path} className="space-y-1.5">
                      <div className="relative group">
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <img
                            src={p.url}
                            alt={p.caption || "Container load"}
                            className="w-full h-32 object-cover rounded-lg border"
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
                      {p.uploaded_at && (
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.uploaded_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      <Input
                        value={p.caption ?? ""}
                        onChange={(e) => setPhotoCaption(p.path, e.target.value)}
                        onBlur={() => persist()}
                        placeholder="Caption"
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DETAILS */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Load details</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input
                  list="container-customers"
                  value={load.customer_name ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    const match = customers.find(
                      (c) => c.customer_name.toLowerCase() === name.toLowerCase(),
                    );
                    update({ customer_name: name, customer_id: match?.id ?? null });
                  }}
                  placeholder="Customer name"
                />
                <datalist id="container-customers">
                  {customers.map((c) => (
                    <option key={c.id} value={c.customer_name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Export date</Label>
                <Input
                  type="date"
                  value={load.export_date ?? ""}
                  onChange={(e) => update({ export_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Container number</Label>
                <Input
                  value={load.container_number ?? ""}
                  onChange={(e) => update({ container_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. MSCU1234567"
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Seal number</Label>
                <Input
                  value={load.seal_number ?? ""}
                  onChange={(e) => update({ seal_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Material / waste description</Label>
                <Input
                  value={load.material ?? ""}
                  onChange={(e) => update({ material: e.target.value })}
                  placeholder="e.g. Mixed paper & board"
                />
              </div>
              <div className="space-y-2">
                <Label>Total weight (tonnes)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={load.total_weight_t ?? ""}
                  onChange={(e) =>
                    update({ total_weight_t: e.target.value === "" ? null : parseFloat(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Basel code</Label>
                <Input
                  value={load.basel_code ?? ""}
                  onChange={(e) => update({ basel_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. B3020"
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>EWC code</Label>
                <Input
                  value={load.ewc_code ?? ""}
                  onChange={(e) => update({ ewc_code: e.target.value })}
                  placeholder="e.g. 19 12 01"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination facility</Label>
                <Input
                  value={load.destination_facility ?? ""}
                  onChange={(e) => update({ destination_facility: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination country</Label>
                <Input
                  value={load.destination_country ?? ""}
                  onChange={(e) => update({ destination_country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Booking reference</Label>
                <Input
                  value={load.booking_reference ?? ""}
                  onChange={(e) => update({ booking_reference: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vessel</Label>
                <Input value={load.vessel ?? ""} onChange={(e) => update({ vessel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Loaded by (operator)</Label>
                <Input
                  value={load.operator_name ?? ""}
                  onChange={(e) => update({ operator_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={load.notes ?? ""}
                  onChange={(e) => update({ notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAPERWORK */}
        <TabsContent value="paperwork" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paperwork method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose how the Annex 7 and Packing List are produced for this container load.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => persist({ paperwork_mode: "upload" })}
                  className={`text-left rounded-lg border p-4 transition hover:border-primary/60 ${
                    load.paperwork_mode === "upload"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">A · Upload paperwork</div>
                  <div className="text-xs text-muted-foreground">
                    Upload existing Annex 7 and Packing List documents (PDF or image).
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => persist({ paperwork_mode: "create" })}
                  className={`text-left rounded-lg border p-4 transition hover:border-primary/60 ${
                    load.paperwork_mode === "create"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">B · Create paperwork</div>
                  <div className="text-xs text-muted-foreground">
                    Fill in the Annex 7 details below and generate Annex 7 &amp; Packing List PDFs.
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {load.paperwork_mode === "upload" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uploaded paperwork</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {(["annex7", "packing"] as const).map((kind) => {
                  const label = kind === "annex7" ? "Annex 7" : "Packing List";
                  const file = kind === "annex7" ? load.annex7_upload : load.packing_upload;
                  return (
                    <div key={kind} className="space-y-2">
                      <Label>{label}</Label>
                      {file ? (
                        <div className="flex items-center gap-2 rounded-md border p-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline flex-1 truncate"
                          >
                            {file.name || label}
                          </a>
                          {file.uploaded_at && (
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(file.uploaded_at).toLocaleDateString("en-GB")}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePaperwork(kind)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Input
                          type="file"
                          accept="application/pdf,image/*"
                          disabled={uploading}
                          onChange={(e) =>
                            uploadPaperwork(kind, e.target.files?.[0] ?? null)
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate documents</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button className="gap-2" onClick={() => handleGenerate("annex7")}>
                  <FileText className="h-4 w-4" /> Annex 7 (PDF)
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => handleGenerate("packing")}>
                  <FileText className="h-4 w-4" /> Packing sheet (PDF)
                </Button>
              </CardContent>
            </Card>
          )}

          {load.paperwork_mode === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Annex 7 details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold">1. Exporter (person who arranges shipment)</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Name"
                    value={load.annex7.exporter_name ?? ""}
                    onChange={(e) => updateAnnex({ exporter_name: e.target.value })}
                  />
                  <Input
                    placeholder="Contact / tel"
                    value={load.annex7.exporter_tel ?? ""}
                    onChange={(e) => updateAnnex({ exporter_tel: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Address"
                    value={load.annex7.exporter_address ?? ""}
                    onChange={(e) => updateAnnex({ exporter_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">2. Importer / consignee</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Name"
                    value={load.annex7.consignee_name ?? ""}
                    onChange={(e) => updateAnnex({ consignee_name: e.target.value })}
                  />
                  <Input
                    placeholder="Contact / tel"
                    value={load.annex7.consignee_tel ?? ""}
                    onChange={(e) => updateAnnex({ consignee_tel: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Address"
                    value={load.annex7.consignee_address ?? ""}
                    onChange={(e) => updateAnnex({ consignee_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">5. Carrier</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Carrier name"
                    value={load.annex7.carrier_name ?? ""}
                    onChange={(e) => updateAnnex({ carrier_name: e.target.value })}
                  />
                  <Input
                    placeholder="Means of transport (e.g. Road + Sea)"
                    value={load.annex7.means_of_transport ?? ""}
                    onChange={(e) => updateAnnex({ means_of_transport: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Carrier address"
                    value={load.annex7.carrier_address ?? ""}
                    onChange={(e) => updateAnnex({ carrier_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">6–8. Countries</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Input
                    placeholder="Dispatch"
                    value={load.annex7.country_dispatch ?? ""}
                    onChange={(e) => updateAnnex({ country_dispatch: e.target.value })}
                  />
                  <Input
                    placeholder="Transit"
                    value={load.annex7.country_transit ?? ""}
                    onChange={(e) => updateAnnex({ country_transit: e.target.value })}
                  />
                  <Input
                    placeholder="Destination"
                    value={load.annex7.country_destination ?? ""}
                    onChange={(e) => updateAnnex({ country_destination: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">11. Recovery facility</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Facility name"
                    value={load.annex7.recovery_facility_name ?? ""}
                    onChange={(e) => updateAnnex({ recovery_facility_name: e.target.value })}
                  />
                  <Input
                    placeholder="Recovery operation (e.g. R3)"
                    value={load.annex7.recovery_operation ?? ""}
                    onChange={(e) => updateAnnex({ recovery_operation: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Facility address"
                    value={load.annex7.recovery_facility_address ?? ""}
                    onChange={(e) => updateAnnex({ recovery_facility_address: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Annex 7 details
              </Button>
            </CardContent>
          </Card>
          )}
        </TabsContent>
      </Tabs>
      <ContainerLoadSendDialog
        load={load}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={() => persist()}
      />
    </div>
  );
};
