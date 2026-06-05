import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Mail, Send, Trash2, Image as ImageIcon, Calculator, ShieldCheck, ShieldX, Award, User as UserIcon, PenLine, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ContaminationActivityLog from "./ContaminationActivityLog";
import ContaminationEmailPreview from "./ContaminationEmailPreview";
import clewsLogo from "@/assets/clews-logo.png";
import {
  PricingTier,
  WasteType,
  ReportedItem,
  findMatchingTier,
  calculateTierCharge,
  calculateItemsCharge,
  describeTier,
} from "@/lib/contamination-pricing";


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

const approvalLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Approval", color: "bg-amber-500 text-white" },
  approved: { label: "Approved", color: "bg-green-600 text-white" },
  rejected: { label: "Rejected", color: "bg-destructive text-destructive-foreground" },
};

const ContaminationDetail = ({ queryId, onBack, isAdmin }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

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

  const { data: wasteTypes = [] } = useQuery({
    queryKey: ["contamination-waste-types"],
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
    queryKey: ["contamination-pricing-tiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contamination_pricing_tiers")
        .select("*")
        .order("display_order");
      return (data || []) as PricingTier[];
    },
  });

  const wasteTypeTiers = useMemo(
    () => (query?.waste_type_id ? tiers.filter((t) => t.waste_type_id === query.waste_type_id) : []),
    [tiers, query?.waste_type_id],
  );

  const suggestedTier = useMemo(
    () => findMatchingTier(wasteTypeTiers, query?.contamination_pct ?? null, query?.sorting_minutes ?? null),
    [wasteTypeTiers, query?.contamination_pct, query?.sorting_minutes],
  );

  const reportedItems = useMemo<ReportedItem[]>(
    () => (Array.isArray(query?.reported_items) ? (query!.reported_items as unknown as ReportedItem[]) : []),
    [query?.reported_items],
  );
  const itemsCharge = useMemo(() => calculateItemsCharge(reportedItems), [reportedItems]);


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

  const handleFieldUpdate = async (updates: Record<string, any>) => {
    await supabase.from("contamination_queries").update(updates).eq("id", queryId);
    refetch();
  };

  // Recalculate the charge from waste type + % / minutes (unless manually overridden)
  const recalcCharge = async (overrides: Partial<Record<string, any>> = {}) => {
    const wasteTypeId = overrides.waste_type_id ?? query.waste_type_id;
    const pct = overrides.contamination_pct ?? query.contamination_pct;
    const minutes = overrides.sorting_minutes ?? query.sorting_minutes;
    const relevantTiers = tiers.filter((t) => t.waste_type_id === wasteTypeId);
    const tier =
      overrides.pricing_tier_id !== undefined
        ? relevantTiers.find((t) => t.id === overrides.pricing_tier_id) || null
        : findMatchingTier(relevantTiers, pct, minutes);
    const calculated = Math.round((calculateTierCharge(tier, query.weight_t) + itemsCharge) * 100) / 100;

    const updates: Record<string, any> = {
      ...overrides,
      pricing_tier_id: tier?.id ?? null,
      calculated_charge: calculated,
    };

    if (!query.charge_overridden) {
      updates.charge_amount = calculated;
    }
    await handleFieldUpdate(updates);
  };

  const handleApprove = async () => {
    const profile = profiles.find((p) => p.id === user?.id);
    await supabase
      .from("contamination_queries")
      .update({
        approval_status: "approved",
        approved_by: user?.id,
        approver_name: profile?.full_name || user?.email || "Unknown",
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", queryId);
    await logActivity("approved", "pending", "approved");
    toast({ title: "Charge Approved", description: "You can now send the customer email." });
    refetch();
    queryClient.invalidateQueries({ queryKey: ["contamination-queries"] });
  };

  const handleReject = async () => {
    const profile = profiles.find((p) => p.id === user?.id);
    await supabase
      .from("contamination_queries")
      .update({
        approval_status: "rejected",
        approved_by: user?.id,
        approver_name: profile?.full_name || user?.email || "Unknown",
        approved_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim() || null,
      })
      .eq("id", queryId);
    await logActivity("rejected", "pending", "rejected", rejectReason.trim() || undefined);
    setRejectReason("");
    toast({ title: "Charge Rejected" });
    refetch();
    queryClient.invalidateQueries({ queryKey: ["contamination-queries"] });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const newPhotos = [...(query.photos || [])];
      for (const file of Array.from(e.target.files)) {
        const filePath = `${queryId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("contamination-photos").upload(filePath, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("contamination-photos").getPublicUrl(filePath);
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

  const currentStatus = statusLabels[query.status] || statusLabels.query;
  const approvalStatus = query.approval_status || "pending";
  const approval = approvalLabels[approvalStatus] || approvalLabels.pending;
  const photos = query.photos || [];
  const isApproved = approvalStatus === "approved";
  const canGenerateEmail = photos.length > 0 && isApproved;

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
            <h1 className="text-2xl font-bold flex items-center gap-3 flex-wrap">
              Job #{query.job_number}
              <Badge className={`${currentStatus.color} text-xs`}>{currentStatus.label}</Badge>
              <Badge className={`${approval.color} text-xs`}>{approval.label}</Badge>
              {query.source_app === "driver" && (
                <Badge variant="outline" className="text-xs">Reported via Driver App</Badge>
              )}
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

            {/* Auto Charge Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Contamination & Charge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <Label>Waste Type</Label>
                    <Select
                      value={query.waste_type_id || ""}
                      onValueChange={(v) => recalcCharge({ waste_type_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select waste type" />
                      </SelectTrigger>
                      <SelectContent>
                        {wasteTypes.map((wt) => (
                          <SelectItem key={wt.id} value={wt.id}>
                            {wt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contamination %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      defaultValue={query.contamination_pct ?? ""}
                      onBlur={(e) =>
                        recalcCharge({ contamination_pct: e.target.value ? parseFloat(e.target.value) : null })
                      }
                      placeholder="e.g. 8"
                    />
                  </div>
                  <div>
                    <Label>Sorting Minutes</Label>
                    <Input
                      type="number"
                      step="1"
                      defaultValue={query.sorting_minutes ?? ""}
                      onBlur={(e) =>
                        recalcCharge({ sorting_minutes: e.target.value ? parseFloat(e.target.value) : null })
                      }
                      placeholder="e.g. 20"
                    />
                  </div>
                  <div>
                    <Label>Tier</Label>
                    <Select
                      value={query.pricing_tier_id || ""}
                      onValueChange={(v) => recalcCharge({ pricing_tier_id: v })}
                      disabled={!query.waste_type_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        {wasteTypeTiers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.tier_name} ({describeTier(t)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {query.waste_type_id && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    {suggestedTier ? (
                      <p>
                        Suggested tier: <span className="font-semibold">{suggestedTier.tier_name}</span>{" "}
                        <span className="text-muted-foreground">({describeTier(suggestedTier)})</span> —{" "}
                        {suggestedTier.per_tonne_fee != null
                          ? `£${suggestedTier.per_tonne_fee}/tonne`
                          : `£${Number(suggestedTier.flat_fee).toFixed(2)} flat`}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Enter a contamination % or sorting minutes to auto-suggest a tier.
                      </p>
                    )}
                    <p>
                      Calculated charge:{" "}
                      <span className="font-semibold">
                        {query.calculated_charge != null ? `£${Number(query.calculated_charge).toFixed(2)}` : "—"}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!query.charge_overridden}
                    onCheckedChange={(c) =>
                      handleFieldUpdate({
                        charge_overridden: c,
                        ...(c ? {} : { charge_amount: query.calculated_charge, override_reason: null }),
                      })
                    }
                  />
                  <span className="text-sm">Override charge manually</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Charge Amount (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={query.charge_amount ?? ""}
                      disabled={!query.charge_overridden}
                      onChange={(e) =>
                        handleFieldUpdate({ charge_amount: e.target.value ? parseFloat(e.target.value) : null })
                      }
                    />
                  </div>
                  {query.charge_overridden && (
                    <div>
                      <Label>Override Reason</Label>
                      <Input
                        defaultValue={query.override_reason || ""}
                        onBlur={(e) => handleFieldUpdate({ override_reason: e.target.value || null })}
                        placeholder="Why was the charge changed?"
                      />
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>PO Number</Label>
                    <Input
                      defaultValue={query.po_number || ""}
                      onBlur={(e) => handleFieldUpdate({ po_number: e.target.value || null })}
                      placeholder="Enter PO when received"
                    />
                  </div>
                  <div>
                    <Label>Recipient Email</Label>
                    <Input
                      type="email"
                      defaultValue={query.recipient_email || ""}
                      onBlur={(e) => handleFieldUpdate({ recipient_email: e.target.value || null })}
                      placeholder="Customer email for contamination notice"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approval Gate */}
            <Card className={approvalStatus === "approved" ? "border-green-600/40" : approvalStatus === "rejected" ? "border-destructive/40" : "border-amber-500/40"}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Management Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={`${approval.color}`}>{approval.label}</Badge>
                  {query.approver_name && query.approved_at && (
                    <span className="text-sm text-muted-foreground">
                      by {query.approver_name} on {format(new Date(query.approved_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  )}
                </div>
                {query.rejection_reason && (
                  <p className="text-sm text-destructive">Reason: {query.rejection_reason}</p>
                )}

                {isAdmin ? (
                  approvalStatus !== "approved" && (
                    <div className="space-y-3">
                      <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Optional rejection reason..."
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleApprove} className="gap-2 bg-green-600 hover:bg-green-700">
                          <ShieldCheck className="h-4 w-4" /> Approve Charge
                        </Button>
                        <Button variant="destructive" onClick={handleReject} className="gap-2">
                          <ShieldX className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  approvalStatus === "pending" && (
                    <p className="text-sm text-muted-foreground">
                      This charge is awaiting management approval before the customer email can be sent.
                    </p>
                  )
                )}
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
                {!isApproved ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    The charge must be approved by management before an email can be sent.
                  </p>
                ) : photos.length === 0 ? (
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
            {/* Reporter */}
            {(query.reporter_name || query.source_app === "driver") && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Reported By
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{query.reporter_name || "Unknown"}</p>
                  {query.reporter_type && (
                    <Badge variant="secondary" className="capitalize">{query.reporter_type}</Badge>
                  )}
                  {query.points_awarded != null && query.points_awarded > 0 && (
                    <p className="flex items-center gap-1.5 text-amber-600 font-semibold">
                      <Award className="h-4 w-4" /> {query.points_awarded} reward points
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Customer Sign-off */}
            {query.customer_signature && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PenLine className="h-5 w-5" />
                    Customer Sign-off
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-lg border border-border bg-white p-2">
                    <img src={query.customer_signature} alt="Customer signature" className="max-h-28 mx-auto" />
                  </div>
                  <p className="text-sm font-medium">{query.customer_signoff_name || "—"}</p>
                  {query.customer_signoff_role && (
                    <p className="text-xs text-muted-foreground">{query.customer_signoff_role}</p>
                  )}
                  {query.customer_signoff_at && (
                    <p className="text-xs text-muted-foreground">
                      Acknowledged {format(new Date(query.customer_signoff_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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
