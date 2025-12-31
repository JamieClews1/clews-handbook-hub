import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { PartnerQuestionnairesList } from "@/components/duty-of-care/PartnerQuestionnairesList";
import { PartnerQuestionnaireForm } from "@/components/duty-of-care/PartnerQuestionnaireForm";
import { supabase } from "@/integrations/supabase/client";


const AdminQuestionnairesPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchQuestionnaires = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_questionnaires')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestionnaires(data || []);
    } catch (error) {
      console.error('Error fetching questionnaires:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchQuestionnaires();
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

  return (
    <AdminPageLayout
      title="Partner Questionnaires"
      description="Manage partner onboarding forms and compliance questionnaires"
    >
      {selectedQuestionnaireId ? (
        <PartnerQuestionnaireForm
          questionnaireId={selectedQuestionnaireId}
          isAdmin={true}
          onBack={() => setSelectedQuestionnaireId(null)}
          onSaved={() => {
            fetchQuestionnaires();
            setSelectedQuestionnaireId(null);
          }}
        />
      ) : (
        <PartnerQuestionnairesList
          questionnaires={questionnaires}
          isAdmin={true}
          onRefresh={fetchQuestionnaires}
          onView={(id) => setSelectedQuestionnaireId(id)}
        />
      )}
    </AdminPageLayout>
  );
};

export default AdminQuestionnairesPage;
