export interface DocumentType {
  id: string;
  name: string;
  category: 'company' | 'partner';
  created_at: string;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  document_name: string;
  document_type_id: string | null;
  document_type_name: string;
  issue_date: string;
  expiry_date: string;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  company_name: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string | null;
  partner_types: string[];
  created_at: string;
  updated_at: string;
}

export interface PartnerDocumentRequirement {
  id: string;
  partner_type: string;
  document_type: string;
  requires_expiry: boolean;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerDocument {
  id: string;
  partner_id: string;
  document_name: string;
  document_type: string;
  expiry_date: string | null;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired';
export type ComplianceStatus = 'compliant' | 'expiring' | 'non_compliant';

export const PARTNER_TYPES = [
  { value: 'disposal_site', label: 'Disposal Site' },
  { value: 'broker', label: 'Broker' },
  { value: 'haulier', label: 'Haulier' },
  { value: 'waste_carrier', label: 'Waste Carrier' },
] as const;

export function getDocumentStatus(expiryDate: string | null): DocumentStatus {
  if (!expiryDate) return 'valid';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
}

export function getStatusColor(status: DocumentStatus): string {
  switch (status) {
    case 'valid': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'expiring_soon': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'expired': return 'bg-red-500/10 text-red-600 border-red-500/20';
  }
}

export function getStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case 'valid': return 'Valid';
    case 'expiring_soon': return 'Expiring Soon';
    case 'expired': return 'Expired';
  }
}
