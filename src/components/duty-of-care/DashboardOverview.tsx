import { FileCheck, Building2, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyDocument, Partner, PartnerDocument, getDocumentStatus } from "./types";

interface DashboardOverviewProps {
  companyDocuments: CompanyDocument[];
  partners: Partner[];
  partnerDocuments: PartnerDocument[];
}

export function DashboardOverview({ companyDocuments, partners, partnerDocuments }: DashboardOverviewProps) {
  const totalCompanyDocuments = companyDocuments.length;
  const totalPartners = partners.length;
  
  // Count partners with expired documents
  const partnersWithExpiredDocs = partners.filter(partner => {
    const docs = partnerDocuments.filter(d => d.partner_id === partner.id);
    return docs.some(doc => getDocumentStatus(doc.expiry_date) === 'expired');
  }).length;
  
  // Count documents expiring in next 30 days (both company and partner)
  const expiringDocuments = [
    ...companyDocuments.filter(doc => getDocumentStatus(doc.expiry_date) === 'expiring_soon'),
    ...partnerDocuments.filter(doc => getDocumentStatus(doc.expiry_date) === 'expiring_soon'),
  ].length;

  const stats = [
    {
      label: "Company Documents",
      value: totalCompanyDocuments,
      icon: FileCheck,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Partners",
      value: totalPartners,
      icon: Building2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Partners with Expired Docs",
      value: partnersWithExpiredDocs,
      icon: AlertTriangle,
      color: partnersWithExpiredDocs > 0 ? "text-red-600" : "text-muted-foreground",
      bgColor: partnersWithExpiredDocs > 0 ? "bg-red-500/10" : "bg-muted/50",
    },
    {
      label: "Expiring in 30 Days",
      value: expiringDocuments,
      icon: Clock,
      color: expiringDocuments > 0 ? "text-amber-600" : "text-muted-foreground",
      bgColor: expiringDocuments > 0 ? "bg-amber-500/10" : "bg-muted/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
