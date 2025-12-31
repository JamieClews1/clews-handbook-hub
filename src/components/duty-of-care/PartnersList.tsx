import { useState } from "react";
import { Plus, Search, Building2, Upload, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Partner, PartnerDocument, PartnerDocumentRequirement, PARTNER_TYPES, getDocumentStatus, ComplianceStatus } from "./types";
import { PartnerDetails } from "./PartnerDetails";

interface PartnersListProps {
  partners: Partner[];
  partnerDocuments: PartnerDocument[];
  requirements: PartnerDocumentRequirement[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export function PartnersList({ partners, partnerDocuments, requirements, isAdmin, onRefresh }: PartnersListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const getPartnerCompliance = (partner: Partner): ComplianceStatus => {
    const docs = partnerDocuments.filter(d => d.partner_id === partner.id);
    
    // Get required documents for this partner's types
    const requiredDocs = requirements.filter(
      req => partner.partner_types.includes(req.partner_type) && req.is_mandatory
    );
    
    // Check for missing mandatory documents
    const missingDocs = requiredDocs.filter(req => 
      !docs.some(doc => doc.document_type === req.document_type)
    );
    
    if (missingDocs.length > 0) return 'non_compliant';
    
    // Check for expired documents
    const hasExpired = docs.some(doc => getDocumentStatus(doc.expiry_date) === 'expired');
    if (hasExpired) return 'non_compliant';
    
    // Check for expiring documents
    const hasExpiring = docs.some(doc => getDocumentStatus(doc.expiry_date) === 'expiring_soon');
    if (hasExpiring) return 'expiring';
    
    return 'compliant';
  };

  const getComplianceIcon = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'expiring': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'non_compliant': return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getComplianceLabel = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant': return 'Fully Compliant';
      case 'expiring': return 'Expiring Documents';
      case 'non_compliant': return 'Non-Compliant';
    }
  };

  const filteredPartners = partners.filter(partner =>
    partner.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPartner = async () => {
    if (!companyName || !contactName || !contactRole || !email || selectedTypes.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('partners')
        .insert({
          company_name: companyName,
          contact_name: contactName,
          contact_role: contactRole,
          email,
          phone: phone || null,
          partner_types: selectedTypes,
        });

      if (error) throw error;

      toast.success("Partner added successfully");
      setIsAddOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to add partner");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const partnersToInsert = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        
        if (row['company name'] && row['contact name'] && row['email']) {
          partnersToInsert.push({
            company_name: row['company name'],
            contact_name: row['contact name'],
            contact_role: row['contact role'] || 'Contact',
            email: row['email'],
            phone: row['phone'] || null,
            partner_types: (row['partner types'] || '').split(';').filter(t => t.trim()),
          });
        }
      }

      if (partnersToInsert.length === 0) {
        toast.error("No valid partners found in CSV");
        return;
      }

      const { error } = await supabase
        .from('partners')
        .insert(partnersToInsert);

      if (error) throw error;

      toast.success(`${partnersToInsert.length} partners imported successfully`);
      setIsImportOpen(false);
      setCsvFile(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to import CSV");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePartner = async (partner: Partner) => {
    if (!confirm(`Are you sure you want to delete ${partner.company_name}?`)) return;

    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partner.id);

      if (error) throw error;

      toast.success("Partner deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete partner");
    }
  };

  const resetForm = () => {
    setCompanyName("");
    setContactName("");
    setContactRole("");
    setEmail("");
    setPhone("");
    setSelectedTypes([]);
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  if (selectedPartner) {
    return (
      <PartnerDetails
        partner={selectedPartner}
        documents={partnerDocuments.filter(d => d.partner_id === selectedPartner.id)}
        requirements={requirements}
        isAdmin={isAdmin}
        onBack={() => setSelectedPartner(null)}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Partners & Duty of Care</CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Partners from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      CSV should have columns: Company Name, Contact Name, Contact Role, Email, Phone, Partner Types (semicolon separated)
                    </p>
                  </div>
                  <Button
                    onClick={handleImportCSV}
                    disabled={isSubmitting || !csvFile}
                    className="w-full"
                  >
                    {isSubmitting ? "Importing..." : "Import Partners"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Partner</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Name *</Label>
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Role *</Label>
                      <Input
                        value={contactRole}
                        onChange={(e) => setContactRole(e.target.value)}
                        placeholder="e.g., Manager"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner Types *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PARTNER_TYPES.map(type => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.value}
                            checked={selectedTypes.includes(type.value)}
                            onCheckedChange={() => toggleType(type.value)}
                          />
                          <Label htmlFor={type.value} className="text-sm font-normal cursor-pointer">
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPartner}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Adding..." : "Add Partner"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Partners List */}
        {filteredPartners.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No partners found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPartners.map((partner) => {
              const compliance = getPartnerCompliance(partner);
              const docCount = partnerDocuments.filter(d => d.partner_id === partner.id).length;
              
              return (
                <div
                  key={partner.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedPartner(partner)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{partner.company_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {partner.contact_name} • {partner.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-2">
                        {getComplianceIcon(compliance)}
                        <span className="text-sm">{getComplianceLabel(compliance)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{docCount} documents</p>
                    </div>
                    <div className="flex gap-1">
                      {partner.partner_types.map(type => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {PARTNER_TYPES.find(t => t.value === type)?.label || type}
                        </Badge>
                      ))}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePartner(partner);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
