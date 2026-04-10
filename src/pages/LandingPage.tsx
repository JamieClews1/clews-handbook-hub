import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Route, Scale, ShieldCheck, Users } from "lucide-react";

const LandingPage = () => {
  const pillars = [
    {
      icon: Route,
      title: "RouteOne",
      subtitle: "Transport Management",
      description: "Job scheduling, driver routing, and logistics dispatch in one unified system.",
    },
    {
      icon: Scale,
      title: "WeighOne",
      subtitle: "Weighbridge Software",
      description: "Record, track, and manage all incoming and outgoing waste loads.",
    },
    {
      icon: ShieldCheck,
      title: "OnePortal",
      subtitle: "Operational Hub",
      description: "Team compliance, health & safety, policies, and internal reporting.",
    },
    {
      icon: Users,
      title: "MyPortal",
      subtitle: "Customer Access",
      description: "Real-time waste data, collection history, and compliance documents.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="W1" className="w-9 h-9 rounded-lg" />
              <span className="font-bold text-xl text-foreground tracking-tight">WasteOne</span>
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/8" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/8 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
        
        <div className="container relative mx-auto px-4 text-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Unified Waste Management
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            One Platform.
            <span className="block text-primary">Total Control.</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Replace skip routing, weighbridge systems, compliance tools and customer portals with a single unified operating system.
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

      {/* Pillars Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Four Pillars. One Platform.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything your waste management operation needs, connected and working together.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {pillars.map((pillar, index) => (
              <div 
                key={pillar.title}
                className="bg-card border border-border/50 rounded-xl p-6 text-center shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <pillar.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{pillar.title}</h3>
                <p className="text-xs text-primary font-medium uppercase tracking-wider mb-3">{pillar.subtitle}</p>
                <p className="text-muted-foreground text-sm">{pillar.description}</p>
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
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">W1</span>
              </div>
              <span className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} WasteOne. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
