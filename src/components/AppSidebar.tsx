import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Route,
  Scale,
  ShieldCheck,
  ScrollText,
  Users,
  Recycle,
  Building2,
  MapPin,
  Truck as TruckIcon,
  Container as ContainerIcon,
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
  Sparkles,
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
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { useSidebarGroupState } from "@/hooks/useSidebarGroupState";

// Shared classes so every nav group looks identical.
const GROUP_LABEL_CLS =
  "cursor-pointer rounded-md transition-colors uppercase tracking-[0.12em] text-[11px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground/80 px-3 h-8";
const GROUP_SPACING_CLS = "mt-5 first:mt-0";
const ICON_CLS = "!h-[18px] !w-[18px]";
const SUB_ICON_CLS = "!h-4 !w-4";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, user } = useAuth();
  const { hidden } = usePortalSectionVisibility();
  const currentPath = location.pathname;

  const isSuperAdmin = isSuperAdminEmail(user?.email);

  // Persisted open/closed state per group (falls back to "open if on that route")
  const [wasteOneOpen, setWasteOneOpen] = useSidebarGroupState(
    "wasteone",
    isInSection(["/route-one", "/weigh-one", "/load-reports", "/performance-hub/stock-check", "/performance-hub/contaminations", "/performance-hub/rentals", "/performance-hub/live-jobs"]),
  );
  const [onePortalOpen, setOnePortalOpen] = useSidebarGroupState(
    "oneportal",
    isInSection(["/duty-of-care", "/policies", "/handbook", "/rams", "/toolbox-talks", "/near-miss", "/waste-reporting", "/site-reports", "/load-reports", "/container-loads", "/diary", "/bookings", "/crm", "/pricing"]),
  );
  const [performanceOpen, setPerformanceOpen] = useSidebarGroupState(
    "performance",
    isInSection(["/performance-hub", "/staci-reports", "/customer-reporting", "/rebate-values"]),
  );
  const [poChecksOpen, setPoChecksOpen] = useSidebarGroupState(
    "po-checks",
    isInSection(["/po-checks"]),
  );
  // Setup collapsed by default — rarely touched.
  const [setupOpen, setSetupOpen] = useSidebarGroupState("setup", false);

  function isInSection(paths: string[]) {
    return paths.some(p => currentPath.startsWith(p));
  }

  const isActive = (path: string) => currentPath === path;

  // Only the super admin sees hidden items (dimmed). Everyone else has them removed.
  const hiddenKeys = Array.from(hidden);
  const gateStyle = hiddenKeys.length
    ? isSuperAdmin
      ? hiddenKeys.map((k) => `[data-sec="${k}"]{opacity:.45}`).join("")
      : hiddenKeys.map((k) => `[data-sec="${k}"]{display:none!important}`).join("")
    : "";



  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {gateStyle && <style>{gateStyle}</style>}
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
        <SidebarGroup className="mt-5 first:mt-0 gap-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/portal")}>
                <Link to="/portal">
                  <LayoutDashboard className="h-[18px] w-[18px]" />
                  {!collapsed && <span>Dashboard</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem data-sec="assistant">
              <SidebarMenuButton asChild isActive={isActive("/assistant")}>
                <Link to="/assistant">
                  <Bot className="h-[18px] w-[18px]" />
                  {!collapsed && <span>Ask One</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem data-sec="ai-assistant">
              <SidebarMenuButton asChild isActive={isActive("/ai-assistant")}>
                <Link to="/ai-assistant">
                  <Sparkles className="h-[18px] w-[18px]" />
                  {!collapsed && <span>Claude Assistant</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* WasteOne */}
        <SidebarGroup className="mt-5 first:mt-0 gap-1">
          <Collapsible defaultOpen={isInSection(["/route-one", "/weigh-one", "/load-reports", "/performance-hub/stock-check", "/performance-hub/contaminations", "/performance-hub/rentals", "/performance-hub/live-jobs"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={GROUP_LABEL_CLS}>
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
                  <SidebarMenuItem data-sec="route-one">
                    <SidebarMenuButton asChild isActive={isActive("/route-one")}>
                      <Link to="/route-one">
                        <Route className="h-[18px] w-[18px]" />
                        {!collapsed && <span>RouteOne</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="weigh-one">
                    <SidebarMenuButton asChild isActive={isActive("/weigh-one")}>
                      <Link to="/weigh-one">
                        <Scale className="h-[18px] w-[18px]" />
                        {!collapsed && <span>WeighOne</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="load-reports">
                    <SidebarMenuButton asChild isActive={isActive("/load-reports")}>
                      <Link to="/load-reports">
                        <TruckIcon className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Load Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-live-jobs">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/live-jobs")}>
                      <Link to="/performance-hub/live-jobs">
                        <Radio className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Live Jobs</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-rentals">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/rentals")}>
                      <Link to="/performance-hub/rentals">
                        <PoundSterling className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Rentals</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-contaminations">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/contaminations")}>
                      <Link to="/performance-hub/contaminations">
                        <AlertTriangle className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Contaminations</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-stock-check">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/stock-check")}>
                      <Link to="/performance-hub/stock-check">
                        <Box className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Stock Check</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>


        {/* OnePortal */}
        <SidebarGroup className="mt-5 first:mt-0 gap-1">
          <Collapsible defaultOpen={isInSection(["/duty-of-care", "/policies", "/handbook", "/rams", "/toolbox-talks", "/near-miss", "/waste-reporting", "/site-reports", "/load-reports", "/container-loads", "/diary", "/bookings"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={GROUP_LABEL_CLS}>
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
                    <SidebarMenuItem data-sec="duty-of-care">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <ShieldCheck className="h-[18px] w-[18px]" />
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

                  <SidebarMenuItem data-sec="policies">
                    <SidebarMenuButton asChild isActive={isActive("/policies")}>
                      <Link to="/policies">
                        <ScrollText className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Policies</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <Collapsible defaultOpen={isInSection(["/handbook", "/rams", "/toolbox-talks"])}>
                    <SidebarMenuItem data-sec="handbook">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <Users className="h-[18px] w-[18px]" />
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

                  <SidebarMenuItem data-sec="waste-reporting">
                    <SidebarMenuButton asChild isActive={isActive("/waste-reporting")}>
                      <Link to="/waste-reporting">
                        <Recycle className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Waste Reporting</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>




                  <SidebarMenuItem data-sec="container-loads">
                    <SidebarMenuButton asChild isActive={isActive("/container-loads")}>
                      <Link to="/container-loads">
                        <ContainerIcon className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Container Loads</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>


                  <SidebarMenuItem data-sec="diary">
                    <SidebarMenuButton asChild isActive={isActive("/diary")}>
                      <Link to="/diary">
                        <Calendar className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Diary</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem data-sec="bookings">
                    <SidebarMenuButton asChild isActive={isActive("/bookings")}>
                      <Link to="/bookings">
                        <CalendarCheck className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Bookings</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem data-sec="crm">
                    <SidebarMenuButton asChild isActive={isActive("/crm")}>
                      <Link to="/crm">
                        <Inbox className="h-[18px] w-[18px]" />
                        {!collapsed && <span>CRM Inbox</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem data-sec="pricing">
                    <SidebarMenuButton asChild isActive={isActive("/pricing")}>
                      <Link to="/pricing">
                        <PoundSterling className="h-[18px] w-[18px]" />
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
        <SidebarGroup className="mt-5 first:mt-0 gap-1">
          <Collapsible defaultOpen={isInSection(["/performance-hub", "/staci-reports", "/customer-reporting", "/rebate-values"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={GROUP_LABEL_CLS}>
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
                  <SidebarMenuItem data-sec="performance-waste-kpis">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/waste-kpis")}>
                      <Link to="/performance-hub/waste-kpis">
                        <Gauge className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Waste KPIs</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-projections">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/projections")}>
                      <Link to="/performance-hub/projections">
                        <TrendingUp className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Projections</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-reports">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/reports")}>
                      <Link to="/performance-hub/reports">
                        <BarChart3 className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="performance-data">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/data")}>
                      <Link to="/performance-hub/data">
                        <Upload className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Data Uploads</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem data-sec="performance-fuel-surcharges">
                    <SidebarMenuButton asChild isActive={isActive("/performance-hub/fuel-surcharges")}>
                      <Link to="/performance-hub/fuel-surcharges">
                        <Fuel className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Fuel Surcharges</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="staci-reports">
                    <SidebarMenuButton asChild isActive={isActive("/staci-reports")}>
                      <Link to="/staci-reports">
                        <Package className="h-[18px] w-[18px]" />
                        {!collapsed && <span>STACI Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="customer-reporting">
                    <SidebarMenuButton asChild isActive={isActive("/customer-reporting")}>
                      <Link to="/customer-reporting">
                        <FileText className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Customer Reports</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem data-sec="rebate-values">
                    <SidebarMenuButton asChild isActive={isActive("/rebate-values")}>
                      <Link to="/rebate-values">
                        <DollarSign className="h-[18px] w-[18px]" />
                        {!collapsed && <span>Rebates</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* PO Checks */}
        <SidebarGroup className="mt-5 first:mt-0 gap-1">
          <Collapsible defaultOpen={isInSection(["/po-checks"])}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={GROUP_LABEL_CLS}>
                {!collapsed && (
                  <>
                    <span>PO Checks</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  </>
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem data-sec="po-checks">
                    <SidebarMenuButton asChild isActive={isActive("/po-checks")}>
                      <Link to="/po-checks">
                        <FileCheck className="h-[18px] w-[18px]" />
                        {!collapsed && <span>PO Checks</span>}
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
          <SidebarGroup className="mt-5 first:mt-0 gap-1">
            <Collapsible defaultOpen={isInSection(["/admin"])}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className={GROUP_LABEL_CLS}>
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
                          <Building2 className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Customers</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/users")}>
                        <Link to="/admin/users">
                          <Users className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Users</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/handbook")}>
                        <Link to="/admin/handbook">
                          <BookOpen className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Handbook Builder</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/rams")}>
                        <Link to="/admin/rams">
                          <FileText className="h-[18px] w-[18px]" />
                          {!collapsed && <span>RAMS Builder</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/toolbox-talks")}>
                        <Link to="/admin/toolbox-talks">
                          <MessageSquare className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Toolbox Talks</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/questionnaires")}>
                        <Link to="/admin/questionnaires">
                          <ClipboardList className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Questionnaires</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isInSection(["/admin/apps", "/admin/driver-app"])}>
                        <Link to="/admin/apps">
                          <Smartphone className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Apps</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/pricing")}>
                        <Link to="/admin/pricing">
                          <DollarSign className="h-[18px] w-[18px]" />
                          {!collapsed && <span>Pricing CMS</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/admin/settings")}>
                        <Link to="/admin/settings">
                          <Settings className="h-[18px] w-[18px]" />
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
