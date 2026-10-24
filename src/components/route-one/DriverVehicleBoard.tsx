import { useEffect, useState, type ReactNode } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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
      <span className="font-semibold text-foreground text-[15px]">{group.type === "Skip Loader" ? "Skip loader" : group.type}</span>
      <span className="text-[13px] text-muted-foreground whitespace-nowrap">{group.drivers.length} {group.drivers.length === 1 ? "driver" : "drivers"} · {group.drivers.reduce((sum, driver) => sum + jobCount(driver), 0)} jobs</span>
    </span>
  );
  if (useDriverAccordion(groups.reduce((sum, group) => sum + group.drivers.length, 0))) {
    return (
      <Accordion type="single" collapsible value={openGroup ?? groups[0]?.type ?? ""} onValueChange={setOpenGroup} className="routeone-vehicle-accordion flex flex-col gap-7">
        {groups.map(group => (
          <AccordionItem key={group.type} value={group.type} className="border-0">
            <AccordionTrigger className="px-1 py-3 hover:no-underline">{summary(group)}</AccordionTrigger>
            <AccordionContent className="pb-0" data-driver-group={group.type}>
                <div className="flex w-max min-w-full items-start gap-2">{group.drivers.map(renderDriver)}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }
  return (
    <div data-driver-count={groups.reduce((sum, group) => sum + group.drivers.length, 0)} aria-label="Drivers grouped by vehicle type">
      <div className="flex w-max min-w-full items-start gap-7">
        {groups.map(group => (
          <section key={group.type} className="flex flex-col shrink-0" aria-label={group.type}>
            <div className="px-1 pb-3">{summary(group)}</div>
            <div className="flex items-start gap-2">{group.drivers.map(renderDriver)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}