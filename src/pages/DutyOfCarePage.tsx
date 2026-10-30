import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileCheck, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeading } from "@/components/PageHeading";
import { DashboardOverview } from "@/components/duty-of-care/DashboardOverview";
import { CompanyDocumentsSection } from "@/components/duty-of-care/CompanyDocumentsSection";
import { CompanyProfile } from "@/components/duty-of-care/CompanyProfile";
import { RequirementsSettings } from "@/components/duty-of-care/RequirementsSettings";
import { PublicRegisterSection } from "@/components/duty-of-care/PublicRegisterSection";
import { EwcRegisterSection } from "@/components/duty-of-care/EwcRegisterSection";
import { CommonWasteTypesSection } from "@/components/duty-of-care/CommonWasteTypesSection";
import { CompanyDocument, Partner, PartnerDocument, PartnerDocumentRequirement, DocumentType } from "@/components/duty-of-care/types";

const DutyOfCarePage = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocument[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerDocuments, setPartnerDocuments] = useState<PartnerDocument[]>([]);
  const [requirements, setRequirements] = useState<PartnerDocumentRequirement[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchData = async () => {
    try {
      const [docsRes, partnersRes, partnerDocsRes, reqsRes, typesRes, questRes] = await Promise.all([
        supabase.from('company_documents').select('*').order('expiry_date', { ascending: true }),
        supabase.from('partners').select('*').order('company_name'),
        supabase.from('partner_documents').select('*'),
        supabase.from('partner_document_requirements').select('*').order('partner_type'),
        supabase.from('document_types').select('*').order('name'),
        supabase.from('partner_questionnaires').select('*').order('created_at', { ascending: false }),
      ]);

      if (docsRes.data) setCompanyDocuments(docsRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
      if (partnerDocsRes.data) setPartnerDocuments(partnerDocsRes.data);
      if (reqsRes.data) setRequirements(reqsRes.data);
      if (typesRes.data) setDocumentTypes(typesRes.data);
      if (questRes.data) setQuestionnaires(questRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <PageHeading title="Duty of Care" description="Compliance documents and partner records" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start h-auto">
            <TabsTrigger value="overview" className="gap-2">
              <FileCheck className="h-4 w-4 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-2">
              <ShieldCheck className="h-4 w-4 hidden sm:inline" />
              Tipping Sites
            </TabsTrigger>
            <TabsTrigger value="ewc" className="gap-2">EWC codes</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4 hidden sm:inline" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DashboardOverview
              companyDocuments={companyDocuments}
              partners={partners}
              partnerDocuments={partnerDocuments}
            />
            <CompanyDocumentsSection
              documents={companyDocuments}
              documentTypes={documentTypes}
              isAdmin={isAdmin}
              onRefresh={fetchData}
            />
          </TabsContent>

          <TabsContent value="register">
            <PublicRegisterSection />
          </TabsContent>

          <TabsContent value="ewc" className="space-y-10">
            <CommonWasteTypesSection />
            <EwcRegisterSection isAdmin={isAdmin} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings" className="space-y-6">
              <CompanyProfile isAdmin={isAdmin} />
              <RequirementsSettings
                requirements={requirements}
                documentTypes={documentTypes}
                isAdmin={isAdmin}
                onRefresh={fetchData}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default DutyOfCarePage;
