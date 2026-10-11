import { useEffect, useState, type ReactNode } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useDriverAccordion, type VehicleKind } from "@/lib/route-one-vehicle-groups";

interface VehicleGroup<T> { type: VehicleKind; drivers: T[] }

export function DriverVehicleBoard<T>({ groups, renderDriver, jobCount }: {
  groups: VehicleGroup<T>[];
  renderDriver: (driver: T) => ReactNode;
  jobCount: (driver: T) => number;
}) {
  const [openGroup, setOpenGroup] = useState<string | undefined>();
  const groupKeys = groups.map(group => group.type).join("|");
  useEffect(() => {
    if (openGroup && !groups.some(group => group.type === openGroup)) setOpenGroup(undefined);
  }, [groupKeys, openGroup]);
  const summary = (group: VehicleGroup<T>) => (
    <span className="flex items-center gap-2 min-w-0">
      <span className="font-bold text-primary-foreground uppercase text-sm">{group.type}</span>
      <Badge variant="secondary" className="shrink-0 bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30">{group.drivers.length} {group.drivers.length === 1 ? "driver" : "drivers"}</Badge>
      <span className="text-xs text-primary-foreground whitespace-nowrap">{group.drivers.reduce((sum, driver) => sum + jobCount(driver), 0)} jobs</span>
    </span>
  );
  if (useDriverAccordion(groups.reduce((sum, group) => sum + group.drivers.length, 0))) {
    return (
      <Accordion type="single" collapsible value={openGroup ?? groups[0]?.type ?? ""} onValueChange={setOpenGroup} className="routeone-vehicle-accordion flex h-full min-h-0 flex-col">
        {groups.map(group => (
          <AccordionItem key={group.type} value={group.type} className="min-h-0 shrink-0 border-b-4 border-background data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
            <AccordionTrigger className="px-3 py-3 bg-primary text-primary-foreground hover:no-underline">{summary(group)}</AccordionTrigger>
            <AccordionContent className="h-full pb-0" data-driver-group={group.type}>
              <div data-driver-count={group.drivers.length} className="routeone-driver-viewport h-full overflow-x-auto overflow-y-hidden">
                <div className="flex h-full w-max min-w-full">{group.drivers.map(renderDriver)}</div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }
  return (
    <div data-driver-count={groups.reduce((sum, group) => sum + group.drivers.length, 0)} className="routeone-driver-viewport h-full overflow-x-auto overflow-y-hidden" aria-label="Drivers grouped by vehicle type">
      <div className="flex h-full w-max min-w-full">
        {groups.map(group => (
          <section key={group.type} className="flex h-full flex-col shrink-0 border-r-4 border-primary" aria-label={group.type}>
            <div className="px-3 py-3 border-b border-primary bg-primary">{summary(group)}</div>
            <div className="flex flex-1 min-h-0">{group.drivers.map(renderDriver)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}