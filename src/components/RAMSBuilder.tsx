import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, FileUp, Save, X, Upload } from "lucide-react";
import { format, addMonths } from "date-fns";
import { SignaturePad } from "@/components/SignaturePad";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RAMS {
  id: string;
  reference_code: string;
  title: string;
  applicable_to: string[];
  notice_to_drivers: string | null;
  created_date: string;
  review_date: string;
  creator_signature: string | null;
  creator_name: string | null;
  signed_at: string | null;
  is_mandatory: boolean;
  user_types: string[];
}

interface Hazard {
  id: string;
  rams_id: string;
  activity: string;
  potential_hazard: string;
  who_at_risk: string;
  initial_likelihood: number;
  initial_severity: number;
  control_measures: string;
  residual_likelihood: number;
  residual_severity: number;
  notes: string | null;
  display_order: number;
}

const USER_TYPE_OPTIONS = ["Yard", "Drivers", "Office"];

const emptyRAMS: Omit<RAMS, "id"> = {
  reference_code: "",
  title: "",
  applicable_to: [],
  notice_to_drivers: "",
  created_date: format(new Date(), "yyyy-MM-dd"),
  review_date: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
  creator_signature: null,
  creator_name: "",
  signed_at: null,
  is_mandatory: false,
  user_types: [],
};

const emptyHazard: Omit<Hazard, "id" | "rams_id"> = {
  activity: "",
  potential_hazard: "",
  who_at_risk: "",
  initial_likelihood: 1,
  initial_severity: 1,
  control_measures: "",
  residual_likelihood: 1,
  residual_severity: 1,
  notes: "",
  display_order: 0,
};

export const RAMSBuilder = () => {
  const { toast } = useToast();
  const [ramsList, setRamsList] = useState<RAMS[]>([]);
  const [selectedRAMS, setSelectedRAMS] = useState<RAMS | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Omit<RAMS, "id">>(emptyRAMS);
  const [editHazards, setEditHazards] = useState<(Omit<Hazard, "id" | "rams_id"> & { id?: string })[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchRAMSList();
  }, []);

  useEffect(() => {
    if (selectedRAMS) {
      fetchHazards(selectedRAMS.id);
    }
  }, [selectedRAMS]);

  const fetchRAMSList = async () => {
    const { data, error } = await supabase
      .from("rams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch RAMS list", variant: "destructive" });
    } else {
      setRamsList((data as RAMS[]) || []);
    }
  };

  const fetchHazards = async (ramsId: string) => {
    const { data, error } = await supabase
      .from("rams_hazards")
      .select("*")
      .eq("rams_id", ramsId)
      .order("display_order");

    if (error) {
      toast({ title: "Error", description: "Failed to fetch hazards", variant: "destructive" });
    } else {
      setHazards((data as Hazard[]) || []);
    }
  };

  const handleCreateNew = () => {
    setSelectedRAMS(null);
    setEditForm(emptyRAMS);
    setEditHazards([{ ...emptyHazard }]);
    setIsEditing(true);
  };

  const handleEdit = (rams: RAMS) => {
    setSelectedRAMS(rams);
    setEditForm({
      reference_code: rams.reference_code,
      title: rams.title,
      applicable_to: rams.applicable_to,
      notice_to_drivers: rams.notice_to_drivers || "",
      created_date: rams.created_date,
      review_date: rams.review_date,
      creator_signature: rams.creator_signature,
      creator_name: rams.creator_name || "",
      signed_at: rams.signed_at,
      is_mandatory: rams.is_mandatory,
      user_types: rams.user_types,
    });
    setEditHazards(hazards.map(h => ({ ...h })));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editForm.reference_code || !editForm.title) {
      toast({ title: "Error", description: "Reference code and title are required", variant: "destructive" });
      return;
    }

    try {
      let ramsId: string;

      if (selectedRAMS) {
        // Update existing RAMS
        const { error } = await supabase
          .from("rams")
          .update({
            ...editForm,
            signed_at: editForm.creator_signature ? new Date().toISOString() : null,
          })
          .eq("id", selectedRAMS.id);

        if (error) throw error;
        ramsId = selectedRAMS.id;

        // Delete existing hazards and re-insert
        await supabase.from("rams_hazards").delete().eq("rams_id", ramsId);
      } else {
        // Create new RAMS
        const { data, error } = await supabase
          .from("rams")
          .insert({
            ...editForm,
            signed_at: editForm.creator_signature ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (error) throw error;
        ramsId = data.id;
      }

      // Insert hazards
      if (editHazards.length > 0) {
        const hazardsToInsert = editHazards.map((h, idx) => ({
          rams_id: ramsId,
          activity: h.activity,
          potential_hazard: h.potential_hazard,
          who_at_risk: h.who_at_risk,
          initial_likelihood: h.initial_likelihood,
          initial_severity: h.initial_severity,
          control_measures: h.control_measures,
          residual_likelihood: h.residual_likelihood,
          residual_severity: h.residual_severity,
          notes: h.notes || null,
          display_order: idx,
        }));

        const { error: hazardError } = await supabase
          .from("rams_hazards")
          .insert(hazardsToInsert);

        if (hazardError) throw hazardError;
      }

      toast({ title: "Success", description: "RAMS saved successfully" });
      setIsEditing(false);
      fetchRAMSList();
      if (ramsId) {
        const { data } = await supabase.from("rams").select("*").eq("id", ramsId).single();
        if (data) {
          setSelectedRAMS(data as RAMS);
          fetchHazards(ramsId);
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save RAMS", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    const { error } = await supabase.from("rams").delete().eq("id", itemToDelete);

    if (error) {
      toast({ title: "Error", description: "Failed to delete RAMS", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "RAMS deleted successfully" });
      setSelectedRAMS(null);
      fetchRAMSList();
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const addHazardRow = () => {
    setEditHazards([...editHazards, { ...emptyHazard, display_order: editHazards.length }]);
  };

  const removeHazardRow = (index: number) => {
    setEditHazards(editHazards.filter((_, i) => i !== index));
  };

  const updateHazard = (index: number, field: string, value: any) => {
    const updated = [...editHazards];
    updated[index] = { ...updated[index], [field]: value };
    setEditHazards(updated);
  };

  const toggleUserType = (type: string) => {
    if (editForm.user_types.includes(type)) {
      setEditForm({ ...editForm, user_types: editForm.user_types.filter(t => t !== type) });
    } else {
      setEditForm({ ...editForm, user_types: [...editForm.user_types, type] });
    }
  };

  const handleApplicableToChange = (value: string) => {
    const items = value.split("\n").filter(item => item.trim());
    setEditForm({ ...editForm, applicable_to: items });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast({ title: "Processing", description: "Parsing document... This feature will be available soon." });
    
    // For now, just show a message - full document parsing would require backend integration
    setTimeout(() => {
      setIsUploading(false);
      toast({ 
        title: "Info", 
        description: "Document upload feature requires backend integration. Please enter data manually for now.",
      });
    }, 1000);
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 4) return "bg-green-500";
    if (risk <= 8) return "bg-yellow-500";
    if (risk <= 12) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">RAMS Builder</h2>
          <p className="text-muted-foreground">Create and manage Risk Assessment Method Statements</p>
        </div>
        <div className="flex gap-2">
          <label htmlFor="file-upload">
            <Button variant="outline" className="gap-2" asChild disabled={isUploading}>
              <span>
                <Upload className="h-4 w-4" />
                {isUploading ? "Processing..." : "Upload Document"}
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".doc,.docx,.docm"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New RAMS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RAMS List */}
        <Card>
          <CardHeader>
            <CardTitle>RAMS Documents</CardTitle>
            <CardDescription>Select a document to view or edit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {ramsList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No RAMS documents yet</p>
            ) : (
              ramsList.map((rams) => (
                <div
                  key={rams.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedRAMS?.id === rams.id ? "bg-accent border-primary" : "hover:bg-accent/50"
                  )}
                  onClick={() => {
                    setSelectedRAMS(rams);
                    setIsEditing(false);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{rams.reference_code}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{rams.title}</p>
                      <div className="flex gap-1 flex-wrap">
                        {rams.is_mandatory && (
                          <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                        )}
                        {rams.user_types.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRAMS(rams);
                          fetchHazards(rams.id);
                          setTimeout(() => handleEdit(rams), 100);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(rams.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* RAMS Detail/Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {isEditing ? (selectedRAMS ? "Edit RAMS" : "Create New RAMS") : "RAMS Details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <RAMSForm
                form={editForm}
                setForm={setEditForm}
                hazards={editHazards}
                updateHazard={updateHazard}
                addHazardRow={addHazardRow}
                removeHazardRow={removeHazardRow}
                toggleUserType={toggleUserType}
                handleApplicableToChange={handleApplicableToChange}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                getRiskColor={getRiskColor}
              />
            ) : selectedRAMS ? (
              <RAMSView rams={selectedRAMS} hazards={hazards} getRiskColor={getRiskColor} />
            ) : (
              <p className="text-muted-foreground">Select a RAMS document or create a new one</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RAMS?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the RAMS document and all its hazards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface RAMSFormProps {
  form: Omit<RAMS, "id">;
  setForm: (form: Omit<RAMS, "id">) => void;
  hazards: (Omit<Hazard, "id" | "rams_id"> & { id?: string })[];
  updateHazard: (index: number, field: string, value: any) => void;
  addHazardRow: () => void;
  removeHazardRow: (index: number) => void;
  toggleUserType: (type: string) => void;
  handleApplicableToChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  getRiskColor: (risk: number) => string;
}

const RAMSForm = ({
  form,
  setForm,
  hazards,
  updateHazard,
  addHazardRow,
  removeHazardRow,
  toggleUserType,
  handleApplicableToChange,
  onSave,
  onCancel,
  getRiskColor,
}: RAMSFormProps) => {
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reference">Reference Code *</Label>
          <Input
            id="reference"
            value={form.reference_code}
            onChange={(e) => setForm({ ...form, reference_code: e.target.value })}
            placeholder="e.g., RA01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., RORO (Roll on and Roll Off Skips)"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Created Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.created_date ? format(new Date(form.created_date), "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.created_date ? new Date(form.created_date) : undefined}
                onSelect={(date) => date && setForm({ ...form, created_date: format(date, "yyyy-MM-dd") })}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Review Date (12 months default)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.review_date ? format(new Date(form.review_date), "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.review_date ? new Date(form.review_date) : undefined}
                onSelect={(date) => date && setForm({ ...form, review_date: format(date, "yyyy-MM-dd") })}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* User Types & Mandatory */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>User Types</Label>
          <div className="flex gap-4 flex-wrap">
            {USER_TYPE_OPTIONS.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Switch
                  checked={form.user_types.includes(type)}
                  onCheckedChange={() => toggleUserType(type)}
                />
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_mandatory}
            onCheckedChange={(checked) => setForm({ ...form, is_mandatory: checked })}
          />
          <Label>Mandatory</Label>
        </div>
      </div>

      {/* Applicable To */}
      <div className="space-y-2">
        <Label>Applicable To (one per line)</Label>
        <Textarea
          value={form.applicable_to.join("\n")}
          onChange={(e) => handleApplicableToChange(e.target.value)}
          placeholder="e.g., Cardboard 40YD Open&#10;End of life Vehicle Components 40YD Open"
          rows={3}
        />
      </div>

      {/* Notice to Drivers */}
      <div className="space-y-2">
        <Label>Notice to Drivers</Label>
        <Textarea
          value={form.notice_to_drivers || ""}
          onChange={(e) => setForm({ ...form, notice_to_drivers: e.target.value })}
          placeholder="Enter notice text..."
          rows={3}
        />
      </div>

      {/* Hazards Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-lg font-semibold">Risk Assessment Hazards</Label>
          <Button size="sm" onClick={addHazardRow} variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Hazard
          </Button>
        </div>

        {hazards.map((hazard, idx) => (
          <Card key={idx} className="p-4 space-y-4">
            <div className="flex justify-between items-start">
              <span className="font-medium">Hazard {idx + 1}</span>
              {hazards.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeHazardRow(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity</Label>
                <Input
                  value={hazard.activity}
                  onChange={(e) => updateHazard(idx, "activity", e.target.value)}
                  placeholder="e.g., Gaining access to bin"
                />
              </div>
              <div className="space-y-2">
                <Label>Potential Hazard</Label>
                <Input
                  value={hazard.potential_hazard}
                  onChange={(e) => updateHazard(idx, "potential_hazard", e.target.value)}
                  placeholder="e.g., Contact with moving vehicles"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Who is at Risk</Label>
              <Input
                value={hazard.who_at_risk}
                onChange={(e) => updateHazard(idx, "who_at_risk", e.target.value)}
                placeholder="e.g., HGV Driver/Forklift Driver"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Initial Likelihood (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.initial_likelihood}
                  onChange={(e) => updateHazard(idx, "initial_likelihood", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Severity (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.initial_severity}
                  onChange={(e) => updateHazard(idx, "initial_severity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Risk</Label>
                <div className={cn(
                  "h-10 rounded-md flex items-center justify-center text-white font-bold",
                  getRiskColor(hazard.initial_likelihood * hazard.initial_severity)
                )}>
                  {hazard.initial_likelihood * hazard.initial_severity}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Control Measures</Label>
              <Textarea
                value={hazard.control_measures}
                onChange={(e) => updateHazard(idx, "control_measures", e.target.value)}
                placeholder="Enter control measures..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Residual Likelihood (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.residual_likelihood}
                  onChange={(e) => updateHazard(idx, "residual_likelihood", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Residual Severity (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.residual_severity}
                  onChange={(e) => updateHazard(idx, "residual_severity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Residual Risk</Label>
                <div className={cn(
                  "h-10 rounded-md flex items-center justify-center text-white font-bold",
                  getRiskColor(hazard.residual_likelihood * hazard.residual_severity)
                )}>
                  {hazard.residual_likelihood * hazard.residual_severity}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={hazard.notes || ""}
                onChange={(e) => updateHazard(idx, "notes", e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Signature */}
      <div className="space-y-4 border-t pt-4">
        <Label className="text-lg font-semibold">Creator Signature</Label>
        <div className="space-y-2">
          <Label>Creator Name</Label>
          <Input
            value={form.creator_name || ""}
            onChange={(e) => setForm({ ...form, creator_name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>
        
        {form.creator_signature ? (
          <div className="space-y-2">
            <Label>Signature</Label>
            <div className="border rounded-md p-2 bg-white">
              <img src={form.creator_signature} alt="Signature" className="max-h-24" />
            </div>
            <Button variant="outline" onClick={() => setForm({ ...form, creator_signature: null })}>
              Clear Signature
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowSignaturePad(true)}>
            Add Signature
          </Button>
        )}

        {showSignaturePad && (
          <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign Document</DialogTitle>
              </DialogHeader>
              <SignaturePad
                onSave={(signature) => {
                  setForm({ ...form, creator_signature: signature });
                  setShowSignaturePad(false);
                }}
                onCancel={() => setShowSignaturePad(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-1" /> Save RAMS
        </Button>
      </div>
    </div>
  );
};

interface RAMSViewProps {
  rams: RAMS;
  hazards: Hazard[];
  getRiskColor: (risk: number) => string;
}

const RAMSView = ({ rams, hazards, getRiskColor }: RAMSViewProps) => {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Reference Code</Label>
          <p className="font-medium">{rams.reference_code}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Title</Label>
          <p className="font-medium">{rams.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Created Date</Label>
          <p>{format(new Date(rams.created_date), "PPP")}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Review Date</Label>
          <p>{format(new Date(rams.review_date), "PPP")}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        {rams.is_mandatory && <Badge variant="destructive">Mandatory</Badge>}
        {rams.user_types.map(type => (
          <Badge key={type} variant="secondary">{type}</Badge>
        ))}
      </div>

      {rams.applicable_to.length > 0 && (
        <div>
          <Label className="text-muted-foreground">Applicable To</Label>
          <ul className="list-disc list-inside">
            {rams.applicable_to.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {rams.notice_to_drivers && (
        <div>
          <Label className="text-muted-foreground">Notice to Drivers</Label>
          <p className="text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200">
            {rams.notice_to_drivers}
          </p>
        </div>
      )}

      {hazards.length > 0 && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Risk Assessment</Label>
          {hazards.map((hazard, idx) => (
            <Card key={hazard.id} className="p-4">
              <div className="space-y-3">
                <div className="font-medium">{hazard.activity}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Potential Hazard</Label>
                    <p>{hazard.potential_hazard}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Who at Risk</Label>
                    <p>{hazard.who_at_risk}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Initial Risk:</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm font-bold",
                      getRiskColor(hazard.initial_likelihood * hazard.initial_severity)
                    )}>
                      {hazard.initial_likelihood} × {hazard.initial_severity} = {hazard.initial_likelihood * hazard.initial_severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Residual Risk:</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm font-bold",
                      getRiskColor(hazard.residual_likelihood * hazard.residual_severity)
                    )}>
                      {hazard.residual_likelihood} × {hazard.residual_severity} = {hazard.residual_likelihood * hazard.residual_severity}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Control Measures</Label>
                  <p className="text-sm">{hazard.control_measures}</p>
                </div>
                {hazard.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{hazard.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {rams.creator_signature && (
        <div className="border-t pt-4">
          <Label className="text-muted-foreground">Creator Signature</Label>
          <div className="flex items-end gap-4">
            <img src={rams.creator_signature} alt="Signature" className="max-h-16 border rounded" />
            <div className="text-sm">
              <p className="font-medium">{rams.creator_name}</p>
              {rams.signed_at && <p className="text-muted-foreground">Signed: {format(new Date(rams.signed_at), "PPP")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
