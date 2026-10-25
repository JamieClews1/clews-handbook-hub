import { useEffect, useRef } from "react";
import { QUICK_LINKS, STAFF_NAV_GROUPS, navigationAllowed, navigationActive, type StaffNavItem } from "@/lib/staff-navigation";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bot, Route, Scale, Radio, Truck, PoundSterling, FileCheck,
  FileSpreadsheet, AlertTriangle, Box, ShieldCheck, ClipboardList, ScrollText, BookOpen,
  Container, Calendar, CalendarCheck, Inbox, Users, HardHat, Flame, MessageSquare,
  FileText, Gauge, TrendingUp, BarChart3, Upload, Fuel, Package, Building2,
  Smartphone, DollarSign, Settings, ChevronDown,
  Gem,
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
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import { cn } from "@/lib/utils";

function NavGroup({ title, icon: Icon, items, initialOpen, storageKey, collapsed, currentPath, hidden, isSuperAdmin }: {
  title: string; icon: LucideIcon; items: StaffNavItem[]; initialOpen: boolean; storageKey: string; collapsed: boolean;
  currentPath: string; hidden: Set<string>; isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useSidebarGroupState(storageKey, initialOpen);
  const { isMobile, setOpenMobile } = useSidebar();
  const previousPath = useRef<string>();
  useEffect(() => {
    if (previousPath.current !== currentPath && items.some(item => navigationActive(item.path, currentPath))) setOpen(true);
    previousPath.current = currentPath;
  }, [currentPath, items, setOpen]);
  const available = items.filter((item) => !item.key || !hidden.has(item.key) || isSuperAdmin);
  const activeGroup = items.some(item => navigationActive(item.path, currentPath));
  if (available.length === 0) return null;
  return (
    <SidebarGroup className="gap-1">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel title={title} aria-label={title} className={cn("h-9 cursor-pointer rounded-md px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-sidebar-ring", activeGroup ? "text-sidebar-primary hover:text-sidebar-primary" : "text-sidebar-foreground hover:text-sidebar-foreground")}>
            {collapsed && <Icon className="h-4 w-4" />}
            {!collapsed && <><span>{title}</span><ChevronDown className="ml-auto h-4 w-4" /></>}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {available.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={navigationActive(item.path, currentPath)} tooltip={item.label}>
                    <Link to={item.path} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                      <item.icon className="h-[18px] w-[18px]" />
                      {!collapsed && <><span>{item.label}</span>{item.key && hidden.has(item.key) && <span className="ml-auto text-xs">Hidden</span>}</>}
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
  const { canAccessPl } = useCompanyPlAccess();
  const access = { isAdmin, canAccessFinance, canAccessPl };
  const groups = STAFF_NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(item => navigationAllowed(item, access)) }));
  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-2" role="navigation" aria-label="Main navigation">
        <div className="mb-2 px-4 py-3">
          <Link to="/portal" aria-label="WasteOne home" className="flex items-center gap-2" onClick={() => { if (isMobile) setOpenMobile(false); }}>
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-md" />
            {!collapsed && <span className="text-lg font-bold text-sidebar-primary">WasteOne</span>}
          </Link>
        </div>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Quick Links</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>
            {QUICK_LINKS.filter(item => !item.key || !hidden.has(item.key) || isSuperAdmin).map(item => <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild tooltip={item.label}>
                <Link to={item.path} onClick={() => { if (isMobile) setOpenMobile(false); }}><item.icon className="h-[18px] w-[18px]" />{!collapsed && <span>{item.label}</span>}</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>)}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        {groups.map((group) => (
          <NavGroup key={group.key} {...group} storageKey={group.key} initialOpen={group.items.some((item) => navigationActive(item.path, pathname))} collapsed={collapsed} currentPath={pathname} hidden={hidden} isSuperAdmin={isSuperAdmin} />
        ))}
      </SidebarContent>
      <SidebarFooter className="p-0"><VersionBadge /></SidebarFooter>
    </Sidebar>
  );
}
