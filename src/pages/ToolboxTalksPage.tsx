import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Users, Shield } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";

const ToolboxTalksPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Clews Recycling</h1>
              <p className="text-sm text-muted-foreground">Toolbox Talks</p>
            </div>
          </div>
          <Link to="/portal">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-accent py-12">
        <div className="container mx-auto px-4 text-center">
          <MessageSquare className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Toolbox Talks
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Short safety briefings to reinforce workplace safety awareness and best practices.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                What are Toolbox Talks?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                <strong>Toolbox Talks</strong> are short, informal safety meetings that focus on 
                specific safety topics related to your daily work activities.
              </p>
              <p>
                These talks typically last 5-15 minutes and are designed to keep safety at the 
                forefront of everyone's mind, reinforce training, and address specific hazards.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Available Topics
              </CardTitle>
              <CardDescription>
                Toolbox talk materials will be available here for supervisors and team leaders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Toolbox Talk materials coming soon.</p>
                <p className="text-sm mt-2">Check back regularly for new safety topics.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ToolboxTalksPage;
