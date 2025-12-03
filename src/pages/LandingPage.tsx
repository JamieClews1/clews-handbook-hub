import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, MessageSquare, Shield, ArrowRight } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";

const LandingPage = () => {
  const features = [
    {
      icon: BookOpen,
      title: "Employee Handbook",
      description: "Access company policies, procedures, and essential workplace information.",
    },
    {
      icon: FileText,
      title: "RAMS",
      description: "Risk Assessments and Method Statements for safe work practices.",
    },
    {
      icon: MessageSquare,
      title: "Toolbox Talks",
      description: "Safety briefings to reinforce workplace awareness.",
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
                <h1 className="text-lg font-semibold text-foreground">Clews Recycling</h1>
              </div>
            </div>
            <Link to="/auth">
              <Button className="gap-2">
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
        
        <div className="container relative mx-auto px-4 text-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Employee Portal
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Welcome to
            <span className="block text-primary">Clews Recycling</span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Your centralized hub for workplace resources, safety documentation, and company policies.
          </p>

          <div className="animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Link to="/auth">
              <Button size="lg" className="gap-2 text-lg px-8 py-6">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground mb-4">What You'll Find</h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to stay informed and safe at work.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <feature.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h4>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto opacity-70" />
              <span className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Clews Recycling. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
