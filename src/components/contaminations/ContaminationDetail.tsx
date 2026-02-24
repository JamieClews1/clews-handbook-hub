import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Mail, Send, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ContaminationActivityLog from "./ContaminationActivityLog";
import ContaminationEmailPreview from "./ContaminationEmailPreview";
import clewsLogo from "@/assets/clews-logo.png";
import { Link } from "react-router-dom";

interface Props {
  queryId: string;
  onBack: () => void;
  isAdmin: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  query: { label: "Query", color: "bg-red-500 text-white" },
  actioned: { label: "Actioned", color: "bg-amber-500 text-white" },
  complete: { label: "Complete", color: "bg-green-500 text-white" },
  resolved: { label: "Resolved", color: "bg-muted text-muted-foreground" },
};

const ContaminationDetail = ({ queryId, onBack, isAdmin }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");

  const { data: query, refetch } = useQuery({
    queryKey: ["contamination-query", queryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_queries")
        .select("*")
        .eq("id", queryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-contaminations"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const { data: chargeMatrix = [] } = useQuery({
    queryKey: ["contamination-charge-matrix"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_charge_matrix")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  if (!query) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const logActivity = async (actionType: string, oldValue?: string, newValue?: string, notes?: string) => {
    const profile = profiles.find((p) => p.id === user?.id);
    await supabase.from("contamination_activity_log").insert({
      query_id: queryId,
      user_id: user?.id,
      user_name: profile?.full_name || user?.email || "Unknown",
      action_type: actionType,
      old_value: oldValue || null,
      new_value: newValue || null,
      notes: notes || null,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    const oldStatus = query.status;
    const updates: any = { status: newStatus };
    if (newStatus === "actioned") updates.actioned_at = new Date().toISOString();
    if (newStatus === "complete") updates.completed_at = new Date().toISOString();
    if (newStatus === "resolved") updates.resolved_at = new Date().toISOString();

    await supabase.from("contamination_queries").update(updates).eq("id", queryId);
    await logActivity("status_change", oldStatus, newStatus);
    toast({ title: "Status Updated" });
    refetch();
    queryClient.invalidateQueries({ queryKey: ["contamination-queries"] });
  };

  const handleOwnerChange = async (ownerId: string) => {
    const profile = profiles.find((p) => p.id === ownerId);
    if (!profile) return;
    const oldOwner = query.owner_name;
    await supabase
      .from("contamination_queries")
      .update({ owner_id: ownerId, owner_name: profile.full_name })
      .eq("id", queryId);
    await logActivity("owner_change", oldOwner || "Unassigned", profile.full_name || "");
    toast({ title: "Owner Updated" });
    refetch();
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    await supabase.from("contamination_queries").update({ [field]: value }).eq("id", queryId);
    refetch();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const newPhotos = [...(query.photos || [])];
      for (const file of Array.from(e.target.files)) {
        const filePath = `${queryId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from("contamination-photos")
          .upload(filePath, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("contamination-photos")
          .getPublicUrl(filePath);
        newPhotos.push(urlData.publicUrl);
      }
      await supabase.from("contamination_queries").update({ photos: newPhotos }).eq("id", queryId);
      await logActivity("photo_uploaded", undefined, `${e.target.files.length} photo(s) uploaded`);
      toast({ title: "Photos Uploaded" });
      refetch();
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (url: string) => {
    const newPhotos = (query.photos || []).filter((p: string) => p !== url);
    await supabase.from("contamination_queries").update({ photos: newPhotos }).eq("id", queryId);
    refetch();
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    await logActivity("note_added", undefined, undefined, note);
    setNote("");
    toast({ title: "Note Added" });
    queryClient.invalidateQueries({ queryKey: ["contamination-activity-log", queryId] });
  };

  const handleContaminationTypeChange = async (type: string) => {
    const matrixItem = chargeMatrix.find((m) => m.contamination_type === type);
    const updates: any = { contamination_type: type };
    if (matrixItem) {
      updates.charge_amount = matrixItem.charge_value;
    }
    await supabase.from("contamination_queries").update(updates).eq("id", queryId);
    refetch();
  };

  const currentStatus = statusLabels[query.status] || statusLabels.query;
  const photos = query.photos || [];
  const canGenerateEmail = photos.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Queries
          </Button>
          <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Job #{query.job_number}
              <Badge className={`${currentStatus.color} text-xs`}>{currentStatus.label}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">{query.customer} — {query.site}</p>
          </div>
          <div className="flex gap-2">
            <Select value={query.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query">Query</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Job Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Details</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{query.customer}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Site</Label>
                  <p className="font-medium">{query.site}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Order Number</Label>
                  <p className="font-medium">{query.order_number || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Job Date</Label>
                  <p className="font-medium">{query.job_date ? format(new Date(query.job_date), "dd/MM/yyyy") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Container Type</Label>
                  <p className="font-medium">{query.container_type || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Waste Description</Label>
                  <p className="font-medium">{query.waste_description || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Weight (t)</Label>
                  <p className="font-medium">{query.weight_t != null ? `${query.weight_t}t` : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Initial Cost</Label>
                  <p className="font-medium">{query.initial_cost != null ? `£${Number(query.initial_cost).toFixed(2)}` : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vehicle Reg</Label>
                  <p className="font-medium">{query.vehicle_reg || "—"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Contamination & Charge */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contamination & Charge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Contamination Type</Label>
                  <Select
                    value={query.contamination_type || ""}
                    onValueChange={handleContaminationTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contamination type" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargeMatrix.map((m) => (
                        <SelectItem key={m.id} value={m.contamination_type}>
                          {m.contamination_type} — £{Number(m.charge_value).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Charge Amount (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={query.charge_amount ?? ""}
                    onChange={(e) => handleFieldUpdate("charge_amount", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label>PO Number</Label>
                  <Input
                    value={query.po_number || ""}
                    onChange={(e) => handleFieldUpdate("po_number", e.target.value || null)}
                    placeholder="Enter PO when received"
                  />
                </div>
                <div>
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    value={query.recipient_email || ""}
                    onChange={(e) => handleFieldUpdate("recipient_email", e.target.value || null)}
                    placeholder="Customer email for contamination notice"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Contamination Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((url: string, i: number) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover" />
                        <button
                          onClick={() => handleDeletePhoto(url)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload photos"}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Email */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Communication
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!canGenerateEmail ? (
                  <p className="text-sm text-muted-foreground">Upload contamination photos before generating an email.</p>
                ) : (
                  <Button onClick={() => setShowEmailPreview(true)} className="gap-2">
                    <Send className="h-4 w-4" />
                    Generate & Preview Email
                  </Button>
                )}
              </CardContent>
            </Card>

            {showEmailPreview && query && (
              <ContaminationEmailPreview
                query={query}
                onClose={() => setShowEmailPreview(false)}
                onSent={() => {
                  setShowEmailPreview(false);
                  handleStatusChange("actioned");
                  refetch();
                }}
              />
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Owner */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Owner</Label>
                <Select value={query.owner_id || ""} onValueChange={handleOwnerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Add Note */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                />
                <Button onClick={handleAddNote} size="sm" disabled={!note.trim()}>
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <ContaminationActivityLog queryId={queryId} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContaminationDetail;
