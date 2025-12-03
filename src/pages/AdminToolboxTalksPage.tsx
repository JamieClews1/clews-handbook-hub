import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const AdminToolboxTalksPage = () => {
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
    <AdminPageLayout title="Toolbox Talk Builder" description="Create and manage safety briefings and training materials">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Toolbox Talks Builder</CardTitle>
          <CardDescription>
            This feature is coming soon. You'll be able to create, manage, and track toolbox talk sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>Features will include:</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Create toolbox talk topics and materials</li>
            <li>• Assign talks to specific user types</li>
            <li>• Track attendance and sign-offs</li>
            <li>• Schedule recurring talks</li>
          </ul>
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
};

export default AdminToolboxTalksPage;
