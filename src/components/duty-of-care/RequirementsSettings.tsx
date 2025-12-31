import { useState } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PartnerDocumentRequirement, PARTNER_TYPES, DocumentType } from "./types";

interface RequirementsSettingsProps {
  requirements: PartnerDocumentRequirement[];
  documentTypes: DocumentType[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export function RequirementsSettings({ requirements, documentTypes, isAdmin, onRefresh }: RequirementsSettingsProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state for requirement
  const [partnerType, setPartnerType] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [requiresExpiry, setRequiresExpiry] = useState(true);
  const [isMandatory, setIsMandatory] = useState(true);
  
  // Form state for document type
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCategory, setNewTypeCategory] = useState<'company' | 'partner'>('company');

  const handleAddRequirement = async () => {
    if (!partnerType || !documentType) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('partner_document_requirements')
        .insert({
          partner_type: partnerType,
          document_type: documentType,
          requires_expiry: requiresExpiry,
          is_mandatory: isMandatory,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("This requirement already exists");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Requirement added successfully");
      setIsAddOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to add requirement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDocumentType = async () => {
    if (!newTypeName) {
      toast.error("Please enter a document type name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('document_types')
        .insert({
          name: newTypeName,
          category: newTypeCategory,
        });

      if (error) throw error;

      toast.success("Document type added successfully");
      setIsAddTypeOpen(false);
      setNewTypeName("");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to add document type");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequirement = async (req: PartnerDocumentRequirement) => {
    if (!confirm("Are you sure you want to delete this requirement?")) return;

    try {
      const { error } = await supabase
        .from('partner_document_requirements')
        .delete()
        .eq('id', req.id);

      if (error) throw error;

      toast.success("Requirement deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete requirement");
    }
  };

  const handleDeleteDocumentType = async (type: DocumentType) => {
    if (!confirm(`Are you sure you want to delete "${type.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('document_types')
        .delete()
        .eq('id', type.id);

      if (error) throw error;

      toast.success("Document type deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document type");
    }
  };

  const resetForm = () => {
    setPartnerType("");
    setDocumentType("");
    setRequiresExpiry(true);
    setIsMandatory(true);
  };

  // Get unique document types from requirements and predefined list
  const allDocTypes = [...new Set([
    ...requirements.map(r => r.document_type),
    ...documentTypes.filter(dt => dt.category === 'partner').map(dt => dt.name),
  ])];

  return (
    <div className="space-y-6">
      {/* Document Types */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Document Types
          </CardTitle>
          {isAdmin && (
            <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Type
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Add Document Type</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Type Name *</Label>
                    <Input
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="e.g., Waste Transfer Note"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={newTypeCategory} onValueChange={(v) => setNewTypeCategory(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleAddDocumentType}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Adding..." : "Add Document Type"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {documentTypes.map(type => (
              <Badge
                key={type.id}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {type.name}
                <span className="text-xs opacity-60">({type.category})</span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive/20"
                    onClick={() => handleDeleteDocumentType(type)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Partner Document Requirements */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Partner Document Requirements</CardTitle>
          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Requirement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Document Requirement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Partner Type *</Label>
                    <Select value={partnerType} onValueChange={setPartnerType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTNER_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Document Type *</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {allDocTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Requires Expiry Date</Label>
                    <Switch
                      checked={requiresExpiry}
                      onCheckedChange={setRequiresExpiry}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Mandatory Document</Label>
                    <Switch
                      checked={isMandatory}
                      onCheckedChange={setIsMandatory}
                    />
                  </div>
                  <Button
                    onClick={handleAddRequirement}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Adding..." : "Add Requirement"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No requirements configured yet. Add requirements to define what documents each partner type needs.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Partner Type</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Requires Expiry</TableHead>
                    <TableHead>Mandatory</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {PARTNER_TYPES.find(t => t.value === req.partner_type)?.label || req.partner_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{req.document_type}</TableCell>
                      <TableCell>
                        <Badge variant={req.requires_expiry ? "default" : "secondary"}>
                          {req.requires_expiry ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={req.is_mandatory ? "default" : "secondary"}>
                          {req.is_mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRequirement(req)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
