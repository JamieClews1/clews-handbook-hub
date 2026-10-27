import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import { usePortalSectionVisibility } from "@/hooks/usePortalSectionVisibility";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { Button } from "@/components/ui/button";
import { STAFF_NAV_GROUPS, navigationAllowed } from "@/lib/staff-navigation";
import { Search } from "lucide-react";

type PageEntry = { name: string; path: string; key?: string };
const otherPages: PageEntry[] = [
  { name: "Dashboard", path: "/portal" },
  { name: "Ask One", path: "/assistant", key: "assistant" },
  { name: "Claude Assistant", path: "/ai-assistant", key: "ai-assistant" },
  { name: "Load Reports", path: "/load-reports", key: "load-reports" },
  { name: "Diary", path: "/diary", key: "diary" },
  { name: "PO Checks", path: "/po-checks", key: "po-checks" },
  { name: "Help", path: "/help" },
];

export function PageCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { canAccess } = useFinanceAccess();
  const { canAccessPl } = useCompanyPlAccess();
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

  const available = [
    ...STAFF_NAV_GROUPS.flatMap(group => group.items.filter(item => navigationAllowed(item, { isAdmin, canAccessFinance: canAccess, canAccessPl })).map(item => ({ name: `${group.title} · ${item.label}`, path: item.path, key: item.key }))),
    ...otherPages,
  ].filter(page => !page.key || !hidden.has(page.key) || superAdmin);

  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-9 gap-2 text-muted-foreground" aria-label="Find a page">
      <Search className="h-4 w-4" /><span className="hidden sm:inline">Find a page</span><kbd className="hidden lg:inline text-xs text-muted-foreground">⌘K</kbd>
    </Button>
    <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <CommandInput placeholder="Find a page…" aria-label="Find a page" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        <CommandGroup heading="Pages">
          {available.map((page) => <CommandItem key={page.path} value={page.name} onSelect={() => { setOpen(false); setQuery(""); navigate(page.path); }}>
            {page.name}
          </CommandItem>)}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  </>;
}