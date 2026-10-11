import { useEffect, useState, type ReactNode } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { VehicleTypeIcon } from "./VehicleTypeIcon";
import { useDriverAccordion, type VehicleKind } from "@/lib/route-one-vehicle-groups";

interface VehicleGroup<T> { type: VehicleKind; drivers: T[] }

export function DriverVehicleBoard<T>({ groups, renderDriver, jobCount }: {
  groups: VehicleGroup<T>[];
  renderDriver: (driver: T) => ReactNode;
  jobCount: (driver: T) => number;
}) {
  const [openGroup, setOpenGroup] = useState<string>(groups[0]?.type ?? "");
  const groupKeys = groups.map(group => group.type).join("|");
  useEffect(() => {
    if (openGroup && !groups.some(group => group.type === openGroup)) setOpenGroup(groups[0]?.type ?? "");
  }, [groupKeys, openGroup]);
  const summary = (group: VehicleGroup<T>) => (
    <span className="flex items-center gap-2 min-w-0">
      <VehicleTypeIcon type={group.type} className="h-6 w-8 shrink-0 text-primary" />
      <span className="font-semibold text-foreground">{group.type}</span>
      <Badge variant="secondary" className="shrink-0">{group.drivers.length} drivers</Badge>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{group.drivers.reduce((sum, driver) => sum + jobCount(driver), 0)} jobs</span>
    </span>
  );
  if (useDriverAccordion(groups.reduce((sum, group) => sum + group.drivers.length, 0))) {
    return (
      <Accordion type="single" collapsible value={openGroup} onValueChange={setOpenGroup} className="routeone-vehicle-accordion flex h-full min-h-0 flex-col">
        {groups.map(group => (
          <AccordionItem key={group.type} value={group.type} className="min-h-0 shrink-0 data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
            <AccordionTrigger className="px-3 py-2 bg-primary/5 hover:no-underline">{summary(group)}</AccordionTrigger>
            <AccordionContent className="h-full pb-0" data-driver-group={group.type}>
              <div className="routeone-driver-viewport h-full overflow-x-auto overflow-y-hidden">
                <div className="flex h-full w-max min-w-full">{group.drivers.map(renderDriver)}</div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }
  return (
    <div className="routeone-driver-viewport h-full overflow-x-auto overflow-y-hidden" aria-label="Drivers grouped by vehicle type">
      <div className="flex h-full w-max min-w-full">
        {groups.map(group => (
          <section key={group.type} className="flex h-full flex-col shrink-0" aria-label={group.type}>
            <div className="px-3 py-2 border-b border-border bg-primary/5">{summary(group)}</div>
            <div className="flex flex-1 min-h-0">{group.drivers.map(renderDriver)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}