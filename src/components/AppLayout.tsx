import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { QUICK_LINKS, STAFF_NAV_GROUPS } from "@/lib/staff-navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { PortalAssistantWidget } from "@/components/PortalAssistantWidget";
import { PageCommandPalette } from "@/components/PageCommandPalette";
import { UrgentContaminationPopup } from "@/components/banksman/UrgentContaminationPopup";
import { FullScreenToggle } from "@/components/FullScreenToggle";
import { Button } from "@/components/ui/button";
import { LogOut, User, Bell, Plus, CircleHelp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { pathname, search } = useLocation();
  const weighOneTablet = pathname === "/weigh-one" && new URLSearchParams(search).get("tablet") === "1";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const item = [...QUICK_LINKS, ...STAFF_NAV_GROUPS.flatMap(group => group.items)]
      .filter(item => pathname === item.path || pathname.startsWith(`${item.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const names: Record<string, string> = { "/portal": "Dashboard", "/diary": "Diary", "/help": "Help", "/route-one": "RouteOne", "/weigh-one": "WeighOne" };
    document.title = `${names[pathname] || item?.label || "Portal"} · WasteOne`;
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "You have been signed out successfully." });
    navigate("/auth");
  };

  // If not logged in, render children without sidebar/header chrome
  if (!user) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (weighOneTablet) {
    return <div className="fixed inset-0 w-full overflow-y-auto bg-background"><UrgentContaminationPopup tablet /><main className="min-h-full w-full min-w-0">{children}</main></div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 rounded-md bg-card px-4 py-2 text-foreground ring-2 ring-ring">Skip to content</a>
        <UrgentContaminationPopup />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation Bar */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              <PageCommandPalette />
            </div>

            <div className="flex items-center gap-1">
              <FullScreenToggle />
              <Button asChild variant="ghost" size="icon" className="text-muted-foreground" title="Help" aria-label="Help">
                <Link to="/help"><CircleHelp className="h-5 w-5" /></Link>
              </Button>
              {/* Quick Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Quick add" className="gap-1.5 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Quick Add</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => navigate("/route-one")}>Add Job</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/admin/customers")}>Add Customer</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/weigh-one?tab=vehicles")}>Add Vehicle</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications */}
              <Button asChild variant="ghost" size="icon" className="text-muted-foreground relative" title="Weighbridge alerts" aria-label="Weighbridge alerts">
                <Link to="/weigh-one?tab=alerts"><Bell className="h-4 w-4" /></Link>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu" className="text-muted-foreground">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/my-profile">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      {!/^\/(ai-assistant|assistant)(\/|$)/.test(pathname) && <PortalAssistantWidget />}
    </SidebarProvider>
  );
}
