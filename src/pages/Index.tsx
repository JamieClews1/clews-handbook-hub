import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import clewsLogo from "@/assets/clews-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

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

  const portalSections = [
    {
      title: "Employee Handbook",
      description: "Company policies, procedures, health & safety guidelines, and essential workplace information.",
      icon: BookOpen,
      href: "/handbook",
      color: "bg-primary",
    },
    {
      title: "RAMS",
      description: "Risk Assessments and Method Statements for safe work practices and compliance.",
      icon: FileText,
      href: "/rams",
      color: "bg-accent",
    },
    {
      title: "Toolbox Talks",
      description: "Short safety briefings and discussions to reinforce workplace safety awareness.",
      icon: MessageSquare,
      href: "/toolbox-talks",
      color: "bg-primary",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Clews Recycling</h1>
              <p className="text-sm text-muted-foreground">Employee Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-accent py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-primary-foreground mb-4">
            Welcome to the Employee Portal
          </h2>
          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Access all your workplace resources, safety documentation, and company policies in one place.
          </p>
        </div>
      </section>

      {/* Portal Sections */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {portalSections.map((section) => (
            <Link key={section.href} to={section.href} className="group">
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2 hover:border-primary">
                <CardHeader className="text-center pb-4">
                  <div className={`${section.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <section.icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center text-base">
                    {section.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Clews Recycling. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
