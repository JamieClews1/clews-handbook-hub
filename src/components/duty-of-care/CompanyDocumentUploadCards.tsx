import { useState, useEffect } from "react";
import { Upload, FileText, Download, Trash2, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CompanyDocument, DocumentType, getDocumentStatus, getStatusColor, getStatusLabel } from "./types";
import { format } from "date-fns";

interface CompanyDocumentUploadCardsProps {
  isAdmin: boolean;
}

export function CompanyDocumentUploadCards({ isAdmin }: CompanyDocumentUploadCardsProps) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Upload form state
  const [documentName, setDocumentName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [typesRes, docsRes] = await Promise.all([
        supabase.from('document_types').select('*').eq('category', 'company').order('name'),
        supabase.from('company_documents').select('*').order('created_at', { ascending: false })
      ]);

      if (typesRes.error) throw typesRes.error;
      if (docsRes.error) throw docsRes.error;

      setDocumentTypes(typesRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentForType = (typeName: string): CompanyDocument | null => {
    return documents.find(doc => doc.document_type_name === typeName) || null;
  };

  const handleUpload = async (documentTypeName: string) => {
    if (!documentName || !issueDate || !expiryDate || !selectedFile) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `company/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('duty-of-care-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert document record
      const { error: insertError } = await supabase
        .from('company_documents')
        .insert({
          document_name: documentName,
          document_type_name: documentTypeName,
          issue_date: issueDate,
          expiry_date: expiryDate,
          file_path: fileName,
          file_name: selectedFile.name,
          uploaded_by: user?.id,
        });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");
      setUploadingType(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('duty-of-care-documents')
        .remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from('company_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success("Document deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const handleDownload = async (doc: CompanyDocument) => {
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
    setIssueDate("");
    setExpiryDate("");
    setSelectedFile(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border/50 animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Company Documents</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documentTypes.map((docType) => {
          const existingDoc = getDocumentForType(docType.name);
          const status = existingDoc ? getDocumentStatus(existingDoc.expiry_date) : null;
          
          return (
            <Card 
              key={docType.id} 
              className={`border-border/50 transition-all ${
                existingDoc 
                  ? status === 'expired' 
                    ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' 
                    : status === 'expiring_soon'
                      ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-green-300 bg-green-50/50 dark:bg-green-950/20'
                  : 'border-dashed'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {existingDoc ? (
                        status === 'expired' ? (
                          <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                        ) : status === 'expiring_soon' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <h5 className="font-medium text-sm truncate">{docType.name}</h5>
                    </div>
                    
                    {existingDoc ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {existingDoc.document_name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${getStatusColor(status!)}`}>
                            {getStatusLabel(status!)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Expires: {format(new Date(existingDoc.expiry_date), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No document uploaded
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {existingDoc && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(existingDoc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(existingDoc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    
                    {isAdmin && (
                      <Dialog 
                        open={uploadingType === docType.name} 
                        onOpenChange={(open) => {
                          if (open) {
                            setUploadingType(docType.name);
                            setDocumentName(docType.name);
                          } else {
                            setUploadingType(null);
                            resetForm();
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant={existingDoc ? "outline" : "default"}
                            size="sm"
                            className="h-8 gap-1"
                          >
                            <Upload className="h-3 w-3" />
                            {existingDoc ? "Replace" : "Upload"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Upload {docType.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Document Name *</Label>
                              <Input
                                value={documentName}
                                onChange={(e) => setDocumentName(e.target.value)}
                                placeholder={`e.g., ${docType.name} 2024`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Issue Date *</Label>
                                <Input
                                  type="date"
                                  value={issueDate}
                                  onChange={(e) => setIssueDate(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Expiry Date *</Label>
                                <Input
                                  type="date"
                                  value={expiryDate}
                                  onChange={(e) => setExpiryDate(e.target.value)}
                                />
                              </div>
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
                              onClick={() => handleUpload(docType.name)}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
