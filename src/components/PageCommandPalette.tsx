import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type PageEntry = { name: string; path: string; key?: string };
const pages: PageEntry[] = [
  { name: "Dashboard", path: "/portal" },
  { name: "Ask One", path: "/assistant", key: "assistant" },
  { name: "Claude Assistant", path: "/ai-assistant", key: "ai-assistant" },
  { name: "RouteOne", path: "/route-one", key: "route-one" },
  { name: "WeighOne", path: "/weigh-one", key: "weigh-one" },
  { name: "Live Jobs", path: "/performance-hub/live-jobs", key: "performance-live-jobs" },
  { name: "Load Reports", path: "/load-reports", key: "load-reports" },
  { name: "Container Loads", path: "/container-loads", key: "container-loads" },
  { name: "Stock Check", path: "/performance-hub/stock-check", key: "performance-stock-check" },
  { name: "Permits", path: "/permits", key: "permits" },
  { name: "Digital Waste Tracking", path: "/digital-waste-tracking", key: "digital-waste-tracking" },
  { name: "Diary", path: "/diary", key: "diary" },
  { name: "Bookings", path: "/bookings", key: "bookings" },
  { name: "CRM Inbox", path: "/crm", key: "crm" },
  { name: "Pricing", path: "/pricing", key: "pricing" },
  { name: "Rentals", path: "/performance-hub/rentals", key: "performance-rentals" },
  { name: "Contaminations", path: "/performance-hub/contaminations", key: "performance-contaminations" },
  { name: "PO Checks", path: "/po-checks", key: "po-checks" },
  { name: "Waste KPIs", path: "/performance-hub/waste-kpis", key: "performance-waste-kpis" },
  { name: "Reports", path: "/performance-hub/reports", key: "performance-reports" },
  { name: "Projections", path: "/performance-hub/projections", key: "performance-projections" },
  { name: "STACI Reports", path: "/staci-reports", key: "staci-reports" },
  { name: "Customer Reporting", path: "/customer-reporting", key: "customer-reporting" },
  { name: "Waste Reporting", path: "/waste-reporting", key: "waste-reporting" },
  { name: "RAMS", path: "/rams", key: "hs-rams" },
  { name: "Toolbox Talks", path: "/toolbox-talks", key: "hs-toolbox-talks" },
  { name: "Near Misses", path: "/near-miss", key: "hs-near-miss" },
  { name: "Site Inductions", path: "/site-inductions", key: "hs-site-inductions" },
  { name: "Fire Safety", path: "/fire-safety", key: "hs-fire-safety" },
  { name: "Policies", path: "/policies", key: "policies" },
  { name: "Handbook", path: "/handbook", key: "handbook" },
  { name: "Help", path: "/help" },
];
const financePages: PageEntry[] = [
  { name: "Invoicing", path: "/finance" },
  { name: "Rebates", path: "/rebate-values" },
  { name: "Fuel Surcharges", path: "/performance-hub/fuel-surcharges" },
  { name: "Payroll & Time", path: "/payroll" },
];
const adminPages: PageEntry[] = [
  { name: "Customer Setup", path: "/admin/customers" },
  { name: "Users", path: "/admin/users" },
  { name: "Settings", path: "/admin/settings" },
  { name: "Data Uploads", path: "/performance-hub/data", key: "performance-data" },
];

export function PageCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { canAccess } = useFinanceAccess();
  const { hidden } = usePortalSectionVisibility();
  const superAdmin = isSuperAdminEmail(user?.email);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const available = [...pages, ...(canAccess ? financePages : []), ...(isAdmin ? adminPages : [])]
    .filter((page) => !page.key || !hidden.has(page.key) || superAdmin);

  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-9 gap-2 text-muted-foreground" aria-label="Find a page">
      <Search className="h-4 w-4" /><span className="hidden sm:inline">Find a page</span><kbd className="hidden lg:inline text-xs text-muted-foreground">⌘K</kbd>
    </Button>
    <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <CommandInput placeholder="Find a page or search jobs…" aria-label="Find a page or search jobs" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        <CommandGroup heading="Pages">
          {available.map((page) => <CommandItem key={page.path} value={page.name} onSelect={() => { setOpen(false); setQuery(""); navigate(page.path); }}>
            {page.name}
          </CommandItem>)}
        </CommandGroup>
        {query.trim() && <CommandGroup heading="Search">
          <CommandItem value={`Search jobs for ${query}`} onSelect={() => { setOpen(false); navigate(`/route-one?search=${encodeURIComponent(query.trim())}`); setQuery(""); }}>
            Search jobs for “{query.trim()}”
          </CommandItem>
        </CommandGroup>}
      </CommandList>
    </CommandDialog>
  </>;
}