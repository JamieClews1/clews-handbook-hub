import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bot, Route, Scale, Radio, Truck, PoundSterling, FileCheck,
  AlertTriangle, Box, ShieldCheck, ClipboardList, ScrollText, BookOpen, Recycle,
  Container, Calendar, CalendarCheck, Inbox, Users, HardHat, Flame, MessageSquare,
  FileText, Gauge, TrendingUp, BarChart3, Upload, Fuel, Package, Building2,
  Smartphone, DollarSign, Settings, ChevronDown, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { VersionBadge } from "./VersionBadge";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { useSidebarGroupState } from "@/hooks/useSidebarGroupState";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";

type NavItem = { label: string; path: string; icon: LucideIcon; key?: string };
const home: NavItem[] = [
  { label: "Dashboard", path: "/portal", icon: LayoutDashboard },
  { label: "Ask One", path: "/assistant", icon: Bot, key: "assistant" },
  { label: "Claude Assistant", path: "/ai-assistant", icon: MessageSquare, key: "ai-assistant" },
];
const operations: NavItem[] = [
  { label: "Live Jobs", path: "/performance-hub/live-jobs", icon: Radio, key: "performance-live-jobs" },
  { label: "RouteOne", path: "/route-one", icon: Route, key: "route-one" },
  { label: "WeighOne", path: "/weigh-one", icon: Scale, key: "weigh-one" },
  { label: "Load Reports", path: "/load-reports", icon: Truck, key: "load-reports" },
  { label: "Container Loads", path: "/container-loads", icon: Container, key: "container-loads" },
  { label: "Stock Check", path: "/performance-hub/stock-check", icon: Box, key: "performance-stock-check" },
  { label: "Permits", path: "/permits", icon: FileCheck, key: "permits" },
  { label: "Digital Waste Tracking", path: "/digital-waste-tracking", icon: Radio, key: "digital-waste-tracking" },
  { label: "Diary", path: "/diary", icon: Calendar, key: "diary" },
  { label: "Bookings", path: "/bookings", icon: CalendarCheck, key: "bookings" },
  { label: "Duty of Care", path: "/duty-of-care", icon: ShieldCheck, key: "duty-of-care" },
  { label: "Site Reports", path: "/site-reports", icon: ClipboardList, key: "duty-of-care" },
  { label: "Handbook", path: "/handbook", icon: BookOpen, key: "handbook" },
];
const customers: NavItem[] = [
  { label: "CRM Inbox", path: "/crm", icon: Inbox, key: "crm" },
  { label: "Pricing", path: "/pricing", icon: PoundSterling, key: "pricing" },
  { label: "Rentals", path: "/performance-hub/rentals", icon: PoundSterling, key: "performance-rentals" },
  { label: "Contaminations", path: "/performance-hub/contaminations", icon: AlertTriangle, key: "performance-contaminations" },
  { label: "PO Checks", path: "/po-checks", icon: FileCheck, key: "po-checks" },
];
const finance: NavItem[] = [
  { label: "Invoicing", path: "/finance", icon: PoundSterling, key: "finance" },
  { label: "Rebates", path: "/rebate-values", icon: DollarSign, key: "rebate-values" },
  { label: "Fuel Surcharges", path: "/performance-hub/fuel-surcharges", icon: Fuel, key: "performance-fuel-surcharges" },
  { label: "Payroll & Time", path: "/payroll", icon: PoundSterling, key: "payroll" },
];
const insights: NavItem[] = [
  { label: "Waste KPIs", path: "/performance-hub/waste-kpis", icon: Gauge, key: "performance-waste-kpis" },
  { label: "Reports", path: "/performance-hub/reports", icon: BarChart3, key: "performance-reports" },
  { label: "Projections", path: "/performance-hub/projections", icon: TrendingUp, key: "performance-projections" },
  { label: "STACI Reports", path: "/staci-reports", icon: Package, key: "staci-reports" },
  { label: "Customer Reports", path: "/customer-reporting", icon: FileText, key: "customer-reporting" },
  { label: "Waste Reporting", path: "/waste-reporting", icon: Recycle, key: "waste-reporting" },
];
const safety: NavItem[] = [
  { label: "RAMS", path: "/rams", icon: FileText, key: "hs-rams" },
  { label: "Toolbox Talks", path: "/toolbox-talks", icon: MessageSquare, key: "hs-toolbox-talks" },
  { label: "Near Misses", path: "/near-miss", icon: AlertTriangle, key: "hs-near-miss" },
  { label: "Site Inductions", path: "/site-inductions", icon: HardHat, key: "hs-site-inductions" },
  { label: "Fire Safety", path: "/fire-safety", icon: Flame, key: "hs-fire-safety" },
  { label: "Policies", path: "/policies", icon: ScrollText, key: "policies" },
];
const admin: NavItem[] = [
  { label: "Customers", path: "/admin/customers", icon: Building2 },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Handbook Builder", path: "/admin/handbook", icon: BookOpen },
  { label: "RAMS Builder", path: "/admin/rams", icon: FileText },
  { label: "Toolbox Talks", path: "/admin/toolbox-talks", icon: MessageSquare },
  { label: "Questionnaires", path: "/admin/questionnaires", icon: ClipboardList },
  { label: "Apps", path: "/admin/apps", icon: Smartphone },
  { label: "Pricing CMS", path: "/admin/pricing", icon: DollarSign },
  { label: "Data Uploads", path: "/performance-hub/data", icon: Upload, key: "performance-data" },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

function NavGroup({ title, items, initialOpen, storageKey, collapsed, currentPath, hidden, isSuperAdmin }: {
  title: string; items: NavItem[]; initialOpen: boolean; storageKey: string; collapsed: boolean;
  currentPath: string; hidden: Set<string>; isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useSidebarGroupState(storageKey, initialOpen);
  const { isMobile, setOpenMobile } = useSidebar();
  const available = items.filter((item) => !item.key || !hidden.has(item.key) || isSuperAdmin);
  if (available.length === 0) return null;
  return (
    <SidebarGroup className="gap-1">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel title={title} className="h-9 cursor-pointer rounded-md px-3 text-[11px] font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            {!collapsed && <><span>{title}</span><ChevronDown className="ml-auto h-4 w-4" /></>}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {available.map((item) => (
                <SidebarMenuItem key={item.path} className={item.key && hidden.has(item.key) ? "opacity-45" : undefined}>
                  <SidebarMenuButton asChild isActive={currentPath === item.path || (item.path === "/admin/apps" && currentPath === "/admin/driver-app")} tooltip={item.label}>
                    <Link to={item.path} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                      <item.icon className="h-[18px] w-[18px]" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { isAdmin, user } = useAuth();
  const { hidden } = usePortalSectionVisibility();
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const { canAccess: canAccessFinance } = useFinanceAccess();
  const groups = [
    { title: "Operations", items: operations, key: "nav-operations" },
    { title: "Customers & Sales", items: customers, key: "nav-customers" },
    ...(canAccessFinance ? [{ title: "Finance", items: finance, key: "nav-finance" }] : []),
    { title: "Insights", items: insights, key: "nav-insights" },
    { title: "Health & Safety", items: safety, key: "nav-safety" },
    ...(isAdmin ? [{ title: "Admin", items: admin, key: "nav-admin" }] : []),
  ];
  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-2">
        <div className="mb-2 px-4 py-3">
          <Link to="/portal" aria-label="WasteOne home" className="flex items-center gap-2" onClick={() => { if (isMobile) setOpenMobile(false); }}>
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-md" />
            {!collapsed && <span className="text-lg font-bold text-sidebar-foreground">WasteOne</span>}
          </Link>
        </div>
        <NavGroup title="Home" items={home} storageKey="nav-home" initialOpen collapsed={collapsed} currentPath={pathname} hidden={hidden} isSuperAdmin={isSuperAdmin} />
        {groups.map((group) => (
          <NavGroup key={group.key} {...group} storageKey={group.key} initialOpen={group.items.some((item) => pathname === item.path)} collapsed={collapsed} currentPath={pathname} hidden={hidden} isSuperAdmin={isSuperAdmin} />
        ))}
      </SidebarContent>
      <SidebarFooter className="p-0"><VersionBadge /></SidebarFooter>
    </Sidebar>
  );
}
