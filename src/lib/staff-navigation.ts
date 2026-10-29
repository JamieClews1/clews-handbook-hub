import { Inbox, Route, Scale, Box, Radio, FileCheck, PoundSterling, Container, Users, AlertTriangle, CalendarCheck, CalendarDays, FileText, Package, Building2, FileSpreadsheet, Fuel, Upload, BarChart3, Gauge, TrendingUp, ClipboardList, Gem, ShieldCheck, HardHat, MessageSquare, Flame, BookOpen, ScrollText, Smartphone, Settings, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationAccess = { isAdmin: boolean; canAccessFinance: boolean; canAccessPl: boolean };
export type StaffNavItem = { label: string; path: string; icon: LucideIcon; key?: string; access?: "admin" | "finance" | "pl" };
export type StaffNavGroup = { title: string; icon: LucideIcon; key: string; items: StaffNavItem[] };
export const QUICK_LINKS: StaffNavItem[] = [
  { label: "Inbox", path: "/inbox", icon: Inbox, key: "crm" },
  { label: "Scheduling", path: "/route-one", icon: Route, key: "route-one" },
  { label: "Weighbridge", path: "/weigh-one", icon: Scale, key: "weigh-one" },
  { label: "Diary", path: "/diary", icon: CalendarDays, key: "diary" },
];
export const STAFF_NAV_GROUPS: StaffNavGroup[] = [
  { title: "RouteOne", icon: Route, key: "nav-routeone", items: [
    QUICK_LINKS[1],
    { label: "Stock Check", path: "/performance-hub/stock-check", icon: Box, key: "performance-stock-check" },
    { label: "Live Jobs", path: "/performance-hub/live-jobs", icon: Radio, key: "performance-live-jobs" },
    { label: "Permits", path: "/permits", icon: FileCheck, key: "permits" },
    { label: "Rentals", path: "/performance-hub/rentals", icon: PoundSterling, key: "performance-rentals" },
    { label: "Pricing", path: "/pricing", icon: PoundSterling, key: "pricing" },
  ] },
  { title: "WeighOne", icon: Scale, key: "nav-weighone", items: [
    QUICK_LINKS[2],
    { label: "Container Loads", path: "/container-loads", icon: Container, key: "container-loads" },
    { label: "Digital Waste Tracking", path: "/digital-waste-tracking", icon: Radio, key: "digital-waste-tracking" },
    { label: "Pricing", path: "/weigh-one/pricing", icon: PoundSterling, key: "weigh-one" },
  ] },
  { title: "Customers & Sales", icon: Users, key: "nav-customers-sales", items: [
    QUICK_LINKS[0],
    { label: "Contaminations", path: "/performance-hub/contaminations", icon: AlertTriangle, key: "performance-contaminations" },
    { label: "Bookings", path: "/bookings", icon: CalendarCheck, key: "bookings" },
    { label: "Customer Reports", path: "/customer-reporting", icon: FileText, key: "customer-reporting" },
    { label: "Load Reports", path: "/load-reports", icon: Truck, key: "load-reports" },
    { label: "Rebates", path: "/rebate-values", icon: PoundSterling, access: "finance" },
    { label: "Staci Reports", path: "/staci-reports", icon: Package, key: "staci-reports" },
    { label: "Customer Setup", path: "/admin/customers", icon: Building2, access: "admin" },
  ] },
  { title: "Finance", icon: PoundSterling, key: "nav-finance", items: [
    { label: "Invoicing", path: "/finance", icon: PoundSterling, key: "finance", access: "finance" },
    { label: "Company P&L", path: "/finance/company-pl", icon: FileSpreadsheet, access: "pl" },
    { label: "Fuel Surcharges", path: "/performance-hub/fuel-surcharges", icon: Fuel, key: "performance-fuel-surcharges", access: "finance" },
    { label: "Payroll & Time", path: "/payroll", icon: PoundSterling, key: "payroll", access: "finance" },
  ] },
  { title: "Insights & Data", icon: BarChart3, key: "nav-insights-data", items: [
    { label: "Data Uploads", path: "/performance-hub/data", icon: Upload, key: "performance-data", access: "admin" },
    { label: "Reports", path: "/performance-hub/reports", icon: BarChart3, key: "performance-reports" },
    { label: "Waste KPIs", path: "/performance-hub/waste-kpis", icon: Gauge, key: "performance-waste-kpis" },
    { label: "Projections", path: "/performance-hub/projections", icon: TrendingUp, key: "performance-projections" },
  ] },
  { title: "Operations", icon: ClipboardList, key: "nav-site-operations", items: [
    QUICK_LINKS[3],
    { label: "Site Reports", path: "/site-reports", icon: ClipboardList, key: "duty-of-care" },
    { label: "Non-Ferrous Metals", path: "/metals", icon: Gem, key: "metals" },
  ] },
  { title: "Compliance", icon: ShieldCheck, key: "nav-compliance", items: [
    { label: "Duty of Care", path: "/duty-of-care", icon: ShieldCheck, key: "duty-of-care" },
    { label: "Questionnaires", path: "/admin/questionnaires", icon: ClipboardList, access: "admin" },
  ] },
  { title: "Team", icon: HardHat, key: "nav-team", items: [
    { label: "RAMS", path: "/rams", icon: FileText, key: "hs-rams" },
    { label: "Site Inductions", path: "/site-inductions", icon: HardHat, key: "hs-site-inductions" },
    { label: "Near Misses", path: "/near-miss", icon: AlertTriangle, key: "hs-near-miss" },
    { label: "Toolbox Talks", path: "/toolbox-talks", icon: MessageSquare, key: "hs-toolbox-talks" },
    { label: "Fire Safety", path: "/fire-safety", icon: Flame, key: "hs-fire-safety" },
    { label: "Handbook", path: "/handbook", icon: BookOpen, key: "handbook" },
    { label: "Policies", path: "/policies", icon: ScrollText, key: "policies" },
  ] },
  { title: "Admin", icon: Settings, key: "nav-admin", items: [
    { label: "Users", path: "/admin/users", icon: Users, access: "admin" },
    { label: "Apps", path: "/admin/apps", icon: Smartphone, access: "admin" },
    { label: "Settings", path: "/admin/settings", icon: Settings, access: "admin" },
  ] },
];

export function navigationAllowed(item: StaffNavItem, access: NavigationAccess) {
  if (item.access === "admin") return access.isAdmin;
  if (item.access === "finance") return access.canAccessFinance;
  if (item.access === "pl") return access.canAccessPl;
  return true;
}

export function navigationActive(path: string, pathname: string) {
  const matchedPath = pathname === "/admin/driver-app" ? "/admin/apps" : pathname;
  const candidates = [...QUICK_LINKS, ...STAFF_NAV_GROUPS.flatMap(group => group.items)]
    .filter(item => matchedPath === item.path || matchedPath.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length);
  return candidates[0]?.path === path;
}