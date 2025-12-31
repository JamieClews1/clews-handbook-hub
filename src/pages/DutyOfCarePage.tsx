import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileCheck, Building2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import clewsLogo from "@/assets/clews-logo.png";
import { DashboardOverview } from "@/components/duty-of-care/DashboardOverview";
import { CompanyDocumentsSection } from "@/components/duty-of-care/CompanyDocumentsSection";
import { PartnersList } from "@/components/duty-of-care/PartnersList";
import { RequirementsSettings } from "@/components/duty-of-care/RequirementsSettings";
import { PartnerQuestionnairesList } from "@/components/duty-of-care/PartnerQuestionnairesList";
import { PartnerQuestionnaireForm } from "@/components/duty-of-care/PartnerQuestionnaireForm";
import { CompanyDocument, Partner, PartnerDocument, PartnerDocumentRequirement, DocumentType } from "@/components/duty-of-care/types";

const DutyOfCarePage = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  
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
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Portal</span>
                </Button>
              </Link>
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <FileCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Duty of Care</h1>
              <p className="text-muted-foreground">Manage compliance documents and partner records</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <FileCheck className="h-4 w-4 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <FileCheck className="h-4 w-4 hidden sm:inline" />
              Company
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-2">
              <Building2 className="h-4 w-4 hidden sm:inline" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="questionnaires" className="gap-2">
              Onboarding
            </TabsTrigger>
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

          <TabsContent value="company">
            <CompanyDocumentsSection
              documents={companyDocuments}
              documentTypes={documentTypes}
              isAdmin={isAdmin}
              onRefresh={fetchData}
            />
          </TabsContent>

          <TabsContent value="partners">
            <PartnersList
              partners={partners}
              partnerDocuments={partnerDocuments}
              requirements={requirements}
              isAdmin={isAdmin}
              onRefresh={fetchData}
            />
          </TabsContent>

          <TabsContent value="questionnaires">
            {selectedQuestionnaireId ? (
              <PartnerQuestionnaireForm
                questionnaireId={selectedQuestionnaireId}
                isAdmin={isAdmin}
                onBack={() => setSelectedQuestionnaireId(null)}
                onSaved={() => {
                  fetchData();
                  setSelectedQuestionnaireId(null);
                }}
              />
            ) : (
              <PartnerQuestionnairesList
                questionnaires={questionnaires}
                isAdmin={isAdmin}
                onRefresh={fetchData}
                onView={(id) => setSelectedQuestionnaireId(id)}
              />
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings">
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
