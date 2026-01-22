import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, MessageSquare, Settings, LogOut, ArrowRight, User, ClipboardSignature, FileCheck, Recycle, ScrollText, ClipboardList, Truck, Upload, Users, DollarSign, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkManagement = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", user.id)
        .single();
      setIsManagement(profile?.user_types?.includes("management") || isAdmin);
    };
    checkManagement();
  }, [user, isAdmin]);

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

  if (!user) {
    return null;
  }

  const loadReportsSections = [
    {
      title: "Load Reports",
      description: "Track pallet loads, weights, and recyclables for yard operations.",
      icon: Truck,
      href: "/load-reports",
    },
  ];

  const complianceHubSections = [
    {
      title: "Duty of Care",
      description: "Waste transfer notes, carrier licenses, and duty of care compliance documentation.",
      icon: FileCheck,
      href: "/duty-of-care",
    },
    {
      title: "Policies",
      description: "Environmental policies, quality policies, and compliance certificates.",
      icon: ScrollText,
      href: "/policies",
    },
    {
      title: "Site Reports",
      description: "Weekly and monthly site reports for operational compliance and monitoring.",
      icon: ClipboardList,
      href: "/site-reports",
    },
  ];

  const dataHubSections = [
    {
      title: "Waste Reporting",
      description: "Waste data reporting, tonnage tracking, and environmental compliance.",
      icon: Recycle,
      href: "/waste-reporting",
    },
    {
      title: "Data Uploads",
      description: "Upload and manage operational data files and reports.",
      icon: Upload,
      href: "/data-hub/uploads",
    },
    {
      title: "Customer Setup",
      description: "Configure customer accounts, preferences, and service agreements.",
      icon: Users,
      href: "#",
      comingSoon: true,
    },
    {
      title: "Rebate Values",
      description: "Manage rebate rates, pricing structures, and value calculations.",
      icon: DollarSign,
      href: "/rebate-values",
    },
  ];

  const teamToolsSections = [
    {
      title: "Employee Handbook",
      description: "Company policies, procedures, health & safety guidelines, and essential workplace information.",
      icon: BookOpen,
      href: "/handbook",
    },
    {
      title: "RAMS",
      description: "Risk Assessments and Method Statements for safe work practices and compliance.",
      icon: FileText,
      href: "/rams",
    },
    {
      title: "Toolbox Talks",
      description: "Short safety briefings and discussions to reinforce workplace safety awareness.",
      icon: MessageSquare,
      href: "/toolbox-talks",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            <div className="flex items-center gap-2">
              <Link to="/my-profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">My Profile</span>
                </Button>
              </Link>
              {isManagement && (
                <Link to="/mass-sign-off">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ClipboardSignature className="h-4 w-4" />
                    <span className="hidden sm:inline">Mass Sign-Off</span>
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
        
        <div className="container relative mx-auto px-4 text-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Welcome back
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Your Workplace
            <span className="block text-primary">Resource Hub</span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Access all your workplace resources, safety documentation, and company policies in one centralized location.
          </p>
        </div>
      </section>

      {/* Portal Sections */}
      <main className="container mx-auto px-4 pb-20">
        {/* Load Reports Section */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-emerald-500 rounded-full" />
            <h3 className="text-2xl font-bold text-foreground">Load Reports</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {loadReportsSections.map((section, index) => (
              <Link 
                key={section.href} 
                to={section.href} 
                className="group animate-fade-up"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <Card className="h-full bg-card border-emerald-500/30 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-emerald-500/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                      <section.icon className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-foreground group-hover:text-emerald-500 transition-colors">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-base text-muted-foreground mb-4">
                      {section.description}
                    </CardDescription>
                    <div className="flex items-center text-emerald-500 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span>Explore</span>
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Compliance Hub Section */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-amber-500 rounded-full" />
            <h3 className="text-2xl font-bold text-foreground">Compliance Hub</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {complianceHubSections.map((section, index) => (
              <Link 
                key={section.href} 
                to={section.href} 
                className="group animate-fade-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <Card className="h-full bg-card border-amber-500/30 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-amber-500/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                      <section.icon className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-foreground group-hover:text-amber-500 transition-colors">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-base text-muted-foreground mb-4">
                      {section.description}
                    </CardDescription>
                    <div className="flex items-center text-amber-500 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span>Explore</span>
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Team Tools Section */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-primary rounded-full" />
            <h3 className="text-2xl font-bold text-foreground">Team Tools</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {teamToolsSections.map((section, index) => (
              <Link 
                key={section.href} 
                to={section.href} 
                className="group animate-fade-up"
                style={{ animationDelay: `${0.7 + index * 0.1}s` }}
              >
                <Card className="h-full bg-card border-border/50 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/30 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
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
                      <span>Explore</span>
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Data Hub & Customers Section */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-yellow-500 rounded-full" />
            <h3 className="text-2xl font-bold text-foreground">Data Hub & Customers</h3>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {dataHubSections.map((section, index) => {
              const isComingSoon = 'comingSoon' in section && section.comingSoon;
              const CardWrapper = isComingSoon ? 'div' : Link;
              const wrapperProps = isComingSoon ? {} : { to: section.href };
              
              return (
                <CardWrapper 
                  key={section.title} 
                  {...wrapperProps as any}
                  className={`group animate-fade-up ${isComingSoon ? 'cursor-not-allowed' : ''}`}
                  style={{ animationDelay: `${1.0 + index * 0.1}s` }}
                >
                  <Card className={`h-full bg-card border-yellow-500/30 shadow-card transition-all duration-300 overflow-hidden ${isComingSoon ? 'opacity-60' : 'hover:shadow-card-hover hover:-translate-y-1 hover:border-yellow-500/50'}`}>
                    <CardHeader className="pb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                        <section.icon className="h-7 w-7 text-white" />
                      </div>
                      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-yellow-500 transition-colors flex items-center gap-2">
                        {section.title}
                        {isComingSoon && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full">Soon</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-base text-muted-foreground mb-4">
                        {section.description}
                      </CardDescription>
                      {!isComingSoon && (
                        <div className="flex items-center text-yellow-500 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span>Explore</span>
                          <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CardWrapper>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto opacity-70" />
              <span className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Clews Recycling
              </span>
            </div>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contact HR
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
