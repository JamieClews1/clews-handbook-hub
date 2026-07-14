import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { HRContactSettings } from "@/components/HRContactSettings";
import { EmailTemplateSettings } from "@/components/EmailTemplateSettings";
import { SectionVisibilitySettings } from "@/components/SectionVisibilitySettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Mail, LayoutGrid } from "lucide-react";


const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
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
    <AdminPageLayout title="Admin Settings" description="Configure system settings, HR contact information, and automated communications">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-2">
            <Mail className="h-4 w-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="sections" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Section Visibility
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <HRContactSettings />
        </TabsContent>

        <TabsContent value="sections">
          <SectionVisibilitySettings />
        </TabsContent>



        <TabsContent value="communications">
          <EmailTemplateSettings />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

export default AdminSettingsPage;
