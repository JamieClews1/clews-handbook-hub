import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { PortalAssistantWidget } from "@/components/PortalAssistantWidget";
import { Button } from "@/components/ui/button";
import { LogOut, User, Search, Bell, Plus } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const searchValue = location.pathname === "/route-one" ? searchParams.get("search") ?? "" : "";

  const handleSearch = (value: string) => {
    if (location.pathname !== "/route-one") {
      navigate(`/route-one${value.trim() ? `?search=${encodeURIComponent(value)}` : ""}`);
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) nextParams.set("search", value);
    else nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "You have been signed out successfully." });
    navigate("/auth");
  };

  // If not logged in, render children without sidebar/header chrome
  if (!user) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation Bar */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              {/* Global Search */}
              <div className="hidden md:flex items-center gap-2 bg-muted/50 rounded-lg px-3 w-72">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchValue}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder="Search jobs, customers, vehicles..."
                  aria-label="Search jobs, customers, vehicles"
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Quick Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Quick Add</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Add Job</DropdownMenuItem>
                  <DropdownMenuItem>Add Customer</DropdownMenuItem>
                  <DropdownMenuItem>Add Vehicle</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                <Bell className="h-4 w-4" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
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
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <PortalAssistantWidget />
    </SidebarProvider>
  );
}
