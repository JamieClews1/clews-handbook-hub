import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Route,
  Scale,
  BarChart3,
  Package,
  ArrowRight,
} from "lucide-react";
import packageJson from "../../package.json";

const appVersion = packageJson.version;

const Index = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
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

  if (!user) return null;

  const pillars = [
    {
      title: "RouteOne",
      subtitle: "Transport & Routing",
      description: "Job scheduling, driver dispatch, and logistics management.",
      icon: Route,
      href: "/route-one",
    },
    {
      title: "WeighOne",
      subtitle: "Weighbridge System",
      description: "Record and manage all incoming and outgoing waste loads.",
      icon: Scale,
      href: "/weigh-one",
    },
    {
      title: "OnePortal",
      subtitle: "Internal Operations",
      description: "Compliance, policies, load reports, safety, and team management.",
      icon: Package,
      href: "/one-portal",
    },
    {
      title: "Performance",
      subtitle: "Analytics & Data",
      description: "Waste KPIs, business reports, contaminations, and stock monitoring.",
      icon: BarChart3,
      href: "/performance-hub",
    },
  ];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your workspace</p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md font-mono">v{appVersion}</span>
      </div>

      {/* Platform Pillars */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((pillar) => (
              <Link key={pillar.title} to={pillar.href} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                <Card className="h-full border-border/50 transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                      <pillar.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {pillar.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-medium">{pillar.subtitle}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                      <div className="flex items-center text-primary font-medium text-xs mt-3">
                        <span>Open</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                  </CardContent>
                </Card>
              </Link>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Index;
