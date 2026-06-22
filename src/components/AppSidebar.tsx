import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Route,
  Scale,
  ShieldCheck,
  ScrollText,
  Users,
  Recycle,
  Building2,
  MapPin,
  Truck as TruckIcon,
  Smartphone,
  CalendarCheck,
  Box,
  Trash2,
  Map,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  ChevronDown,
  BookOpen,
  FileText,
  MessageSquare,
  ClipboardList,
  FileCheck,
  Package,
  AlertTriangle,
  Upload,
  Gauge,
  Radio,
  TrendingUp,
  Fuel,
  PoundSterling,
  Inbox,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { VersionBadge } from "./VersionBadge";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isInSection = (paths: string[]) => paths.some(p => currentPath.startsWith(p));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-2">
        {/* Brand */}
        <div className="px-4 py-3 mb-2">
          {!collapsed ? (
            <Link to="/portal" className="flex items-center gap-2">
              <img src="/logo.png" alt="W1" className="w-8 h-8 rounded-lg" />
              <div>
                <span className="font-bold text-sidebar-foreground text-lg tracking-tight">WasteOne</span>
                <span className="block text-[10px] text-sidebar-foreground/50 -mt-1 tracking-widest uppercase">Platform</span>
              </div>
            </Link>
          ) : (
            <Link to="/portal" className="flex justify-center">
              <img src="/logo.png" alt="W1" className="w-8 h-8 rounded-lg" />
            </Link>
          )}
        </div>

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/portal")}>
                <Link to="/portal">
                  <LayoutDashboard className="h-4 w-4" />
                  {!collapsed && <span>Dashboard</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* WasteOne */}
        <SidebarGroup>
          <Collapsible defaultOpen={isInSection(["/route-one", "/weigh-one"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors">
                {!collapsed && (
                  <>
                    <span>WasteOne</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  </>
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/route-one")}>
                      <Link to="/route-one">
                        <Route className="h-4 w-4" />
                        {!collapsed && <span>RouteOne</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/weigh-one")}>
                      <Link to="/weigh-one">
                        <Scale className="h-4 w-4" />
                        {!collapsed && <span>WeighOne</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* OnePortal */}
        <SidebarGroup>
          <Collapsible defaultOpen={isInSection(["/duty-of-care", "/policies", "/handbook", "/rams", "/toolbox-talks", "/near-miss", "/waste-reporting", "/site-reports", "/load-reports", "/diary", "/bookings"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors">
                {!collapsed && (
                  <>
                    <span>OnePortal</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  </>
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible defaultOpen={isInSection(["/duty-of-care", "/near-miss", "/site-reports"])}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <ShieldCheck className="h-4 w-4" />
                          {!collapsed && <span>Compliance</span>}
                          {!collapsed && <ChevronDown className="ml-auto h-3 w-3" />}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/duty-of-care")}>
                              <Link to="/duty-of-care"><FileCheck className="h-3.5 w-3.5" /><span>Duty of Care</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/near-miss")}>
                              <Link to="/near-miss"><ClipboardList className="h-3.5 w-3.5" /><span>Near Miss</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/site-reports")}>
                              <Link to="/site-reports"><ClipboardList className="h-3.5 w-3.5" /><span>Site Reports</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/policies")}>
                      <Link to="/policies">
                        <ScrollText className="h-4 w-4" />
                        {!collapsed && <span>Policies</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <Collapsible defaultOpen={isInSection(["/handbook", "/rams", "/toolbox-talks"])}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <Users className="h-4 w-4" />
                          {!collapsed && <span>Team</span>}
                          {!collapsed && <ChevronDown className="ml-auto h-3 w-3" />}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/handbook")}>
                              <Link to="/handbook"><BookOpen className="h-3.5 w-3.5" /><span>Handbook</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/rams")}>
                              <Link to="/rams"><FileText className="h-3.5 w-3.5" /><span>RAMS</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/toolbox-talks")}>
                              <Link to="/toolbox-talks"><MessageSquare className="h-3.5 w-3.5" /><span>Toolbox Talks</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/waste-reporting")}>
                      <Link to="/waste-reporting">
                        <Recycle className="h-4 w-4" />
                        {!collapsed && <span>Waste Reporting</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/load-reports")}>
                      <Link to="/load-reports">
                        <TruckIcon className="h-4 w-4" />
                        {!collapsed && <span>Load Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/diary")}>
                      <Link to="/diary">
                        <Calendar className="h-4 w-4" />
                        {!collapsed && <span>Diary</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/bookings")}>
                      <Link to="/bookings">
                        <CalendarCheck className="h-4 w-4" />
                        {!collapsed && <span>Bookings</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/crm")}>
                      <Link to="/crm">
                        <Inbox className="h-4 w-4" />
                        {!collapsed && <span>CRM Inbox</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/pricing")}>
                      <Link to="/pricing">
                        <PoundSterling className="h-4 w-4" />
                        {!collapsed && <span>Pricing</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Performance & Data */}
        <SidebarGroup>
          <Collapsible defaultOpen={isInSection(["/performance-hub", "/staci-reports", "/customer-reporting", "/rebate-values"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors">
                {!collapsed && (
                  <>
                    <span>Performance</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  </>
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/waste-kpis")}>
                      <Link to="/performance-hub/waste-kpis">
                        <Gauge className="h-4 w-4" />
                        {!collapsed && <span>Waste KPIs</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/projections")}>
                      <Link to="/performance-hub/projections">
                        <TrendingUp className="h-4 w-4" />
                        {!collapsed && <span>Projections</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/reports")}>
                      <Link to="/performance-hub/reports">
                        <BarChart3 className="h-4 w-4" />
                        {!collapsed && <span>Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/live-jobs")}>
                      <Link to="/performance-hub/live-jobs">
                        <Radio className="h-4 w-4" />
                        {!collapsed && <span>Live Jobs</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/rentals")}>
                      <Link to="/performance-hub/rentals">
                        <PoundSterling className="h-4 w-4" />
                        {!collapsed && <span>Rentals</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/data")}>
                      <Link to="/performance-hub/data">
                        <Upload className="h-4 w-4" />
                        {!collapsed && <span>Data Uploads</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/contaminations")}>
                      <Link to="/performance-hub/contaminations">
                        <AlertTriangle className="h-4 w-4" />
                        {!collapsed && <span>Contaminations</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/stock-check")}>
                      <Link to="/performance-hub/stock-check">
                        <Box className="h-4 w-4" />
                        {!collapsed && <span>Stock Check</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/fuel-surcharges")}>
                      <Link to="/performance-hub/fuel-surcharges">
                        <Fuel className="h-4 w-4" />
                        {!collapsed && <span>Fuel Surcharges</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/staci-reports")}>
                      <Link to="/staci-reports">
                        <Package className="h-4 w-4" />
                        {!collapsed && <span>STACI Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/customer-reporting")}>
                      <Link to="/customer-reporting">
                        <FileText className="h-4 w-4" />
                        {!collapsed && <span>Customer Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/rebate-values")}>
                      <Link to="/rebate-values">
                        <DollarSign className="h-4 w-4" />
                        {!collapsed && <span>Rebate Values</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Setup (Admin) */}
        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isInSection(["/admin"])}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors">
                  {!collapsed && (
                    <>
                      <span>Setup</span>
                      <ChevronDown className="ml-auto h-3.5 w-3.5" />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/customers")}>
                        <Link to="/admin/customers">
                          <Building2 className="h-4 w-4" />
                          {!collapsed && <span>Customers</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/users")}>
                        <Link to="/admin/users">
                          <Users className="h-4 w-4" />
                          {!collapsed && <span>Users</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/handbook")}>
                        <Link to="/admin/handbook">
                          <BookOpen className="h-4 w-4" />
                          {!collapsed && <span>Handbook Builder</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/rams")}>
                        <Link to="/admin/rams">
                          <FileText className="h-4 w-4" />
                          {!collapsed && <span>RAMS Builder</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/toolbox-talks")}>
                        <Link to="/admin/toolbox-talks">
                          <MessageSquare className="h-4 w-4" />
                          {!collapsed && <span>Toolbox Talks</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/questionnaires")}>
                        <Link to="/admin/questionnaires">
                          <ClipboardList className="h-4 w-4" />
                          {!collapsed && <span>Questionnaires</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isInSection(["/admin/apps", "/admin/driver-app"])}>
                        <Link to="/admin/apps">
                          <Smartphone className="h-4 w-4" />
                          {!collapsed && <span>Apps</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/pricing")}>
                        <Link to="/admin/pricing">
                          <DollarSign className="h-4 w-4" />
                          {!collapsed && <span>Pricing CMS</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/settings")}>
                        <Link to="/admin/settings">
                          <Settings className="h-4 w-4" />
                          {!collapsed && <span>Settings</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-0">
        <VersionBadge />
      </SidebarFooter>
    </Sidebar>
  );
}
