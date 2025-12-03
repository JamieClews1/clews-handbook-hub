import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, MessageSquare, Users, LogOut, ArrowRight, Home, ClipboardSignature, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/auth");
  };

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

  const adminSections = [
    {
      title: "Handbook Builder",
      description: "Create and manage employee handbook sections, content, and translations.",
      icon: BookOpen,
      href: "/admin/handbook",
      gradient: "from-primary to-primary/80",
    },
    {
      title: "RAMS Builder",
      description: "Build and manage Risk Assessments and Method Statements for workplace safety.",
      icon: FileText,
      href: "/admin/rams",
      gradient: "from-secondary to-secondary/80",
    },
    {
      title: "Toolbox Talk Builder",
      description: "Create and manage safety briefings and training materials.",
      icon: MessageSquare,
      href: "/admin/toolbox-talks",
      gradient: "from-warning to-warning/80",
    },
    {
      title: "Users Admin",
      description: "Manage user accounts, roles, permissions, and compliance tracking.",
      icon: Users,
      href: "/admin/users",
      gradient: "from-accent to-accent/80",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Portal</span>
                </Button>
              </Link>
              <Link to="/mass-sign-off">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ClipboardSignature className="h-4 w-4" />
                  <span className="hidden sm:inline">Mass Sign-Off</span>
                </Button>
              </Link>
              <Link to="/admin/settings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
        
        <div className="container relative mx-auto px-4 text-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Administrator Access
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Content
            <span className="block text-primary">Management</span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Build and manage handbooks, safety documents, and user accounts from one central dashboard.
          </p>
        </div>
      </section>

      {/* Admin Sections */}
      <main className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {adminSections.map((section, index) => (
            <Link 
              key={section.href} 
              to={section.href} 
              className="group animate-fade-up"
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <Card className="h-full bg-card border-border/50 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/30 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${section.gradient} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg`}>
                    <section.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-base text-muted-foreground mb-4">
                    {section.description}
                  </CardDescription>
                  <div className="flex items-center text-primary font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span>Open</span>
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto opacity-70" />
              <span className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Clews Recycling - Admin Panel
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminPage;
