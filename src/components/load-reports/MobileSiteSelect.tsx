import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteOption {
  id: string;
  site_name: string;
}

interface MobileSiteSelectProps {
  value: string;
  sites: SiteOption[];
  onValueChange: (siteId: string) => void;
  placeholder?: string;
}

export const MobileSiteSelect = ({
  value,
  sites,
  onValueChange,
  placeholder = "Select a site",
}: MobileSiteSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedSite = sites.find((site) => site.id === value);

  const handleSelect = (siteId: string) => {
    onValueChange(siteId);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-14 w-full justify-between text-lg font-normal"
        >
          <span className={cn(!selectedSite && "text-muted-foreground")}>
            {selectedSite?.site_name || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Site</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            {sites.map((site) => (
              <Button
                key={site.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left h-12 text-base",
                  value === site.id && "bg-accent"
                )}
                onClick={() => handleSelect(site.id)}
              >
                <Check
                  className={cn(
                    "mr-3 h-5 w-5 shrink-0",
                    value === site.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {site.site_name}
              </Button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
