import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertTriangle, ClipboardList } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";

const RAMSPage = () => {
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
              <p className="text-sm text-muted-foreground">RAMS</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-accent to-primary py-12">
        <div className="container mx-auto px-4 text-center">
          <FileText className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Risk Assessments & Method Statements
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Essential documentation for safe work practices and regulatory compliance.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                What are RAMS?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                <strong>Risk Assessments and Method Statements (RAMS)</strong> are essential documents 
                that outline potential hazards and the safe procedures for carrying out work activities.
              </p>
              <p>
                These documents help ensure that all employees understand the risks involved in their 
                work and the steps they need to take to protect themselves and others.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Available Documents
              </CardTitle>
              <CardDescription>
                RAMS documents will be available here. Contact your supervisor for specific documentation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>RAMS documents coming soon.</p>
                <p className="text-sm mt-2">Contact your line manager for current documentation.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RAMSPage;
