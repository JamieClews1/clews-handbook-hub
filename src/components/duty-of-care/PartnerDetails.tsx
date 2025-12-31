import { useState } from "react";
import { ArrowLeft, Plus, Upload, Download, Trash2, FileText, CheckCircle2, AlertTriangle, XCircle, Mail, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Partner, PartnerDocument, PartnerDocumentRequirement, PARTNER_TYPES, getDocumentStatus, getStatusColor, getStatusLabel } from "./types";
import { format } from "date-fns";

interface PartnerDetailsProps {
  partner: Partner;
  documents: PartnerDocument[];
  requirements: PartnerDocumentRequirement[];
  isAdmin: boolean;
  onBack: () => void;
  onRefresh: () => void;
}

export function PartnerDetails({ partner, documents, requirements, isAdmin, onBack, onRefresh }: PartnerDetailsProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Upload form state
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Get required documents for this partner
  const requiredDocs = requirements.filter(
    req => partner.partner_types.includes(req.partner_type)
  );

  // Deduplicate by document type
  const uniqueRequiredDocs = requiredDocs.reduce((acc, req) => {
    if (!acc.find(r => r.document_type === req.document_type)) {
      acc.push(req);
    }
    return acc;
  }, [] as PartnerDocumentRequirement[]);

  // Check compliance for each required document
  const getDocComplianceStatus = (docType: string) => {
    const doc = documents.find(d => d.document_type === docType);
    if (!doc) return 'missing';
    return getDocumentStatus(doc.expiry_date);
  };

  const handleUpload = async () => {
    if (!documentName || !documentType || !selectedFile) {
      toast.error("Please fill in all required fields");
      return;
    }

    const requirement = uniqueRequiredDocs.find(r => r.document_type === documentType);
    if (requirement?.requires_expiry && !expiryDate) {
      toast.error("This document type requires an expiry date");
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `partners/${partner.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('duty-of-care-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert document record
      const { error: insertError } = await supabase
        .from('partner_documents')
        .insert({
          partner_id: partner.id,
          document_name: documentName,
          document_type: documentType,
          expiry_date: expiryDate || null,
          file_path: fileName,
          file_name: selectedFile.name,
          uploaded_by: user?.id,
        });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");
      setIsUploadOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: PartnerDocument) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('duty-of-care-documents')
        .remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from('partner_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success("Document deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const handleDownload = async (doc: PartnerDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('duty-of-care-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download document");
    }
  };

  const resetForm = () => {
    setDocumentName("");
    setDocumentType("");
    setExpiryDate("");
    setSelectedFile(null);
  };

  // Get available document types for upload
  const availableDocTypes = uniqueRequiredDocs.map(r => r.document_type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{partner.company_name}</h2>
          <div className="flex flex-wrap gap-2 mt-1">
            {partner.partner_types.map(type => (
              <Badge key={type} variant="secondary">
                {PARTNER_TYPES.find(t => t.value === type)?.label || type}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact</p>
              <p className="font-medium">{partner.contact_name}</p>
              <p className="text-xs text-muted-foreground">{partner.contact_role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <a href={`mailto:${partner.email}`} className="font-medium text-primary hover:underline">
                {partner.email}
              </a>
            </div>
          </div>
          {partner.phone && (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a href={`tel:${partner.phone}`} className="font-medium">
                  {partner.phone}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Required Documents Checklist */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Required Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uniqueRequiredDocs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No document requirements configured for this partner type.</p>
            ) : (
              uniqueRequiredDocs.map(req => {
                const status = getDocComplianceStatus(req.document_type);
                const doc = documents.find(d => d.document_type === req.document_type);
                
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      {status === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      {status === 'expiring_soon' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                      {status === 'expired' && <XCircle className="h-5 w-5 text-red-600" />}
                      {status === 'missing' && <XCircle className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="font-medium text-sm">{req.document_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.is_mandatory ? 'Mandatory' : 'Optional'}
                          {req.requires_expiry && ' • Requires expiry date'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {status === 'missing' ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Missing
                        </Badge>
                      ) : (
                        <div>
                          <Badge variant="outline" className={getStatusColor(status as any)}>
                            {getStatusLabel(status as any)}
                          </Badge>
                          {doc?.expiry_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expires: {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Documents</CardTitle>
          {isAdmin && (
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Partner Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Document Name *</Label>
                    <Input
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="e.g., Waste Carrier Licence 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Document Type *</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDocTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Expiry Date {uniqueRequiredDocs.find(r => r.document_type === documentType)?.requires_expiry ? '*' : ''}
                    </Label>
                    <Input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Document File *</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG</p>
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => {
                    const status = getDocumentStatus(doc.expiry_date);
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.document_name}</TableCell>
                        <TableCell>{doc.document_type}</TableCell>
                        <TableCell>
                          {doc.expiry_date ? format(new Date(doc.expiry_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(status)}>
                            {getStatusLabel(status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(doc)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
