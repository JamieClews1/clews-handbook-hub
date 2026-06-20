import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  Route,
  Scale,
  Users,
  BarChart3,
  AlertTriangle,
  Package,
  ArrowRight,
} from "lucide-react";

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

  const quickStats = [
    { label: "Today's Jobs", value: "—", icon: Truck, color: "text-primary" },
    { label: "Drivers Active", value: "—", icon: Users, color: "text-secondary" },
    { label: "Tonnes Today", value: "—", icon: Scale, color: "text-primary" },
    { label: "Open Queries", value: "—", icon: AlertTriangle, color: "text-warning" },
  ];

  const pillars = [
    {
      title: "RouteOne",
      subtitle: "Transport & Routing",
      description: "Job scheduling, driver dispatch, and logistics management.",
      icon: Route,
      href: "/route-one",
      gradient: "from-primary to-primary/80",
      coming: true,
    },
    {
      title: "WeighOne",
      subtitle: "Weighbridge System",
      description: "Record and manage all incoming and outgoing waste loads.",
      icon: Scale,
      href: "/weigh-one",
      gradient: "from-secondary to-secondary/80",
      coming: true,
    },
    {
      title: "OnePortal",
      subtitle: "Internal Operations",
      description: "Compliance, policies, load reports, safety, and team management.",
      icon: Package,
      href: "/one-portal",
      gradient: "from-primary to-secondary",
    },
    {
      title: "Performance",
      subtitle: "Analytics & Data",
      description: "Waste KPIs, business reports, contaminations, and stock monitoring.",
      icon: BarChart3,
      href: "/performance-hub",
      gradient: "from-secondary to-primary",
    },
  ];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Here's your operational overview.</p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md font-mono">v1.0.0</span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Pillars */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((pillar) => {
            const Wrapper = pillar.coming ? "div" : Link;
            const wrapperProps = pillar.coming ? {} : { to: pillar.href };
            return (
              <Wrapper
                key={pillar.title}
                {...(wrapperProps as any)}
                className={`group ${pillar.coming ? "cursor-default" : ""}`}
              >
                <Card className={`h-full border-border/50 transition-all duration-200 ${pillar.coming ? "opacity-60" : "hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/30"}`}>
                  <CardHeader className="pb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-3`}>
                      <pillar.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {pillar.title}
                      {pillar.coming && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">Coming Soon</span>
                      )}
                    </CardTitle>
                    <p className="text-[10px] text-primary font-medium uppercase tracking-wider">{pillar.subtitle}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                    {!pillar.coming && (
                      <div className="flex items-center text-primary font-medium text-xs mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Open</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Wrapper>
            );
          })}
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        <Card className="border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="text-sm">Activity feed will appear here as the system is used.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
