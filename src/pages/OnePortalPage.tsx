import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  Package,
  BookOpen,
  Shield,
  ClipboardList,
  FileText,
  AlertTriangle,
  Recycle,
  Users,
  HardHat,
  CalendarDays,
  PoundSterling,
} from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { useEffect } from "react";

const sections = [
  { key: "load-reports", title: "Load Reports", description: "Record and manage pallet loads across customer sites", icon: Package, href: "/load-reports" },
  { key: "site-reports", title: "Site Reports", description: "Monthly inspections, walkarounds and stock reports", icon: ClipboardList, href: "/site-reports" },
  { key: "handbook", title: "Handbook", description: "Employee handbook and company policies documentation", icon: BookOpen, href: "/handbook" },
  { key: "rams", title: "RAMS", description: "Risk assessments and method statements", icon: Shield, href: "/rams" },
  { key: "toolbox-talks", title: "Toolbox Talks", description: "Safety briefings and team training records", icon: HardHat, href: "/toolbox-talks" },
  { key: "policies", title: "Policies", description: "Company policies and compliance documents", icon: FileText, href: "/policies" },
  { key: "near-miss", title: "Near Miss", description: "Report and track near miss incidents", icon: AlertTriangle, href: "/near-miss", variant: "destructive" as const },
  { key: "duty-of-care", title: "Duty of Care", description: "Partner compliance, documents and questionnaires", icon: Users, href: "/duty-of-care" },
  { key: "diary", title: "Diary", description: "Weekly outlook and gentle planning journal", icon: CalendarDays, href: "/diary", variant: "calm" as const },
  { key: "waste-reporting", title: "Waste Reporting", description: "Facility recycling forms and waste documentation", icon: Recycle, href: "/waste-reporting" },
  { key: "pricing", title: "Pricing", description: "Rate cards by customer type with postcode zone checker", icon: PoundSterling, href: "/pricing" },
];


const OnePortalPage = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const { isHidden } = usePortalSectionVisibility();


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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/portal">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Portal</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-foreground mb-12">
            ONEPORTAL
          </h1>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((section) => (
              <Link key={section.title} to={section.href} className="group">
                <div
                  className={`h-full p-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${
                    section.variant === "destructive"
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-primary hover:bg-primary/90"
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <section.icon
                      className={`h-12 w-12 ${
                        section.variant === "destructive"
                          ? "text-destructive-foreground"
                          : "text-primary-foreground"
                      }`}
                    />
                    <h2
                      className={`text-xl font-bold uppercase tracking-wide ${
                        section.variant === "destructive"
                          ? "text-destructive-foreground"
                          : "text-primary-foreground"
                      }`}
                    >
                      {section.title}
                    </h2>
                    <p
                      className={`text-sm ${
                        section.variant === "destructive"
                          ? "text-destructive-foreground/80"
                          : "text-primary-foreground/80"
                      }`}
                    >
                      {section.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default OnePortalPage;
