import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerQuestionnairesList } from "@/components/duty-of-care/PartnerQuestionnairesList";
import { PartnerQuestionnaireForm } from "@/components/duty-of-care/PartnerQuestionnaireForm";
import { QuestionnaireTemplatesList } from "@/components/duty-of-care/QuestionnaireTemplatesList";
import { QuestionnaireTemplateBuilder } from "@/components/duty-of-care/QuestionnaireTemplateBuilder";
import { supabase } from "@/integrations/supabase/client";
import { FileQuestion, Settings2 } from "lucide-react";

const AdminQuestionnairesPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("responses");
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchData = async () => {
    try {
      const [questRes, templateRes] = await Promise.all([
        supabase
          .from('partner_questionnaires')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('questionnaire_templates')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (questRes.data) setQuestionnaires(questRes.data);
      if (templateRes.data) setTemplates(templateRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

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

  if (!user || !isAdmin) {
    return null;
  }

  // Show template builder if editing or creating
  if (selectedTemplateId || isCreatingTemplate) {
    return (
      <AdminPageLayout
        title="Partner Questionnaires"
        description="Manage partner onboarding forms and compliance questionnaires"
      >
        <QuestionnaireTemplateBuilder
          templateId={selectedTemplateId || undefined}
          onBack={() => {
            setSelectedTemplateId(null);
            setIsCreatingTemplate(false);
          }}
          onSaved={() => {
            fetchData();
            setSelectedTemplateId(null);
            setIsCreatingTemplate(false);
          }}
        />
      </AdminPageLayout>
    );
  }

  // Show questionnaire form if editing
  if (selectedQuestionnaireId) {
    return (
      <AdminPageLayout
        title="Partner Questionnaires"
        description="Manage partner onboarding forms and compliance questionnaires"
      >
        <PartnerQuestionnaireForm
          questionnaireId={selectedQuestionnaireId}
          isAdmin={true}
          onBack={() => setSelectedQuestionnaireId(null)}
          onSaved={() => {
            fetchData();
            setSelectedQuestionnaireId(null);
          }}
        />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Partner Questionnaires"
      description="Manage partner onboarding forms and compliance questionnaires"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="responses" className="gap-2">
            <FileQuestion className="h-4 w-4" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="responses">
          <PartnerQuestionnairesList
            questionnaires={questionnaires}
            isAdmin={true}
            onRefresh={fetchData}
            onView={(id) => setSelectedQuestionnaireId(id)}
          />
        </TabsContent>

        <TabsContent value="templates">
          <QuestionnaireTemplatesList
            templates={templates}
            onRefresh={fetchData}
            onEdit={(id) => setSelectedTemplateId(id)}
            onCreate={() => setIsCreatingTemplate(true)}
          />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

export default AdminQuestionnairesPage;
