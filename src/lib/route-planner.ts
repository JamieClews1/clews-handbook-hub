import type { RoutingRules } from "@/hooks/useRoutingRules";

export type PlannerJob = {
  id: string;
  source: "route_one" | "skiptrak";
  jobNumber: string;
  movement: string;
  containerType: string;
  containerSize?: string | null;
  customer: string;
  site: string;
  postcode: string;
  currentDriverId: string | null;
  currentDriverName: string | null;
};

export type PlannerDriver = {
  id: string;
  name: string;
  registration: string | null;
  vehicleType: string | null;
  category: string | null;
};

export type PlannedJob = {
  job: PlannerJob;
  start: string;
  end: string;
  reason: string;
  movedFrom: string | null;
};

export type DriverPlan = {
  driver: PlannerDriver;
  lane: Lane;
  jobs: PlannedJob[];
  totalMinutes: number;
};

export type RoutePlan = {
  drivers: DriverPlan[];
  unplanned: { job: PlannerJob; reason: string }[];
  warnings: string[];
  notWorking: PlannerDriver[];
};

export type Lane = "skip" | "roro" | "artic";

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

/** Which kind of work a job represents, from its container type. */
export function laneForJob(job: PlannerJob, rules: RoutingRules): Lane | null {
  const t = norm(job.containerType) + " " + norm(job.containerSize) + " " + norm(job.movement);
  if (/curtain|walking floor|bulk ejector|artic/.test(t)) return "artic";
  if (/ro ?ro|roll on|roll-on/.test(t)) return "roro";
  if (/skip|yard|yd|chain lift/.test(t)) return "skip";
  if (/waste truck/.test(t)) return "artic";
  return null;
}

/** Which lane a driver can serve, from their vehicle. */
export function laneForDriver(driver: PlannerDriver, rules: RoutingRules): Lane | null {
  const reg = norm(driver.registration).replace(/\s+/g, "");
  if (rules.artic_regs.some(r => norm(r).replace(/\s+/g, "") === reg && reg)) return "artic";
  const t = norm(driver.vehicleType) + " " + norm(driver.category);
  if (/artic|curtain|walking floor/.test(t)) return "artic";
  if (/ro ?ro/.test(t)) return "roro";
  if (/skip|grab|tipper|chain/.test(t)) return "skip";
  return null;
}

const outward = (postcode: string) => norm(postcode).replace(/\s+/g, " ").split(" ")[0] || "";

export type LatLng = { lat: number; lng: number };

/** Extra information the planner can use to work out real travel times. */
export type TravelContext = {
  /** Postcode (letters and digits only, upper case) → coordinates. */
  coords?: Map<string, LatLng>;
  /** Postcode → configured zone name. */
  zoneFor?: (postcode: string) => string | null;
};

const pcKey = (pc: string | null | undefined) => String(pc ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const haversineMiles = (a: LatLng, b: LatLng) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

/**
 * Minutes to travel from one postcode to another.
 * Distance model: real postcode-to-postcode miles at the configured average speed.
 * Zone model: an average time per postcode zone.
 * Fixed model (or missing data): the flat travel allowance.
 */
export function travelMinutes(
  fromPostcode: string | null | undefined,
  toPostcode: string | null | undefined,
  rules: RoutingRules,
  ctx?: TravelContext,
): { minutes: number; basis: string } {
  const flat = { minutes: rules.mins_travel, basis: `${rules.mins_travel} min flat allowance` };

  if (rules.travel_model === "distance") {
    const a = ctx?.coords?.get(pcKey(fromPostcode));
    const b = ctx?.coords?.get(pcKey(toPostcode));
    if (a && b) {
      const miles = haversineMiles(a, b) * (rules.road_distance_factor || 1.3);
      const mins = Math.max(rules.mins_travel_min, Math.round((miles / (rules.avg_speed_mph || 28)) * 60));
      return { minutes: mins, basis: `${miles.toFixed(1)} miles at ${rules.avg_speed_mph} mph` };
    }
  }

  if (rules.travel_model === "zone" || rules.travel_model === "distance") {
    const zf = ctx?.zoneFor;
    const zoneA = fromPostcode ? zf?.(fromPostcode) ?? null : null;
    const zoneB = toPostcode ? zf?.(toPostcode) ?? null : null;
    const table = rules.zone_travel_minutes || {};
    if (zoneB && zoneA && zoneA === zoneB) {
      return { minutes: Math.max(rules.mins_travel_min, rules.mins_travel_within_zone), basis: `within ${zoneA}` };
    }
    const mb = zoneB ? table[zoneB] : undefined;
    const ma = zoneA ? table[zoneA] : undefined;
    if (typeof mb === "number" || typeof ma === "number") {
      const mins = Math.max(rules.mins_travel_min, Math.round(Math.max(mb ?? 0, ma ?? 0)));
      return { minutes: mins, basis: `average time for ${zoneB || zoneA}` };
    }
  }

  return flat;
}

const minutesForMovement = (movement: string, rules: RoutingRules) => {
  const m = norm(movement);
  if (m.includes("exchange")) return rules.mins_exchange;
  if (m.includes("collect")) return rules.mins_collection + rules.mins_tipping;
  if (m.includes("deliver")) return rules.mins_delivery;
  return rules.mins_delivery;
};

const sizeOf = (job: PlannerJob) => {
  const m = (norm(job.containerSize) + " " + norm(job.containerType)).match(/(\d{1,2})\s*(yd|yard)/);
  return m ? Number(m[1]) : null;
};

const fmt = (dayStart: string, offsetMin: number) => {
  const [h, m] = dayStart.split(":").map(Number);
  const total = (isFinite(h) ? h : 7) * 60 + (isFinite(m) ? m : 0) + offsetMin;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/**
 * Order jobs so deliveries in the same postcode area travel together, then
 * collections (which must return to tip) fall in behind them.
 */
function sequence(jobs: PlannerJob[]): PlannerJob[] {
  const groups = new Map<string, PlannerJob[]>();
  for (const j of jobs) {
    const key = outward(j.postcode) || "zz";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(j);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const out: PlannerJob[] = [];
  for (const [, list] of ordered) {
    const deliveries = list.filter(j => norm(j.movement).includes("deliver"));
    const rest = list.filter(j => !norm(j.movement).includes("deliver"));
    out.push(...deliveries, ...rest);
  }
  return out;
}

/** Max empty skips that can leave together for a given group of deliveries. */
export function skipLoadCapacity(jobs: PlannerJob[], rules: RoutingRules): number {
  const sizes = jobs.map(sizeOf).filter((s): s is number => s != null);
  if (sizes.length === 0) return rules.max_skips_per_load;
  const biggest = Math.max(...sizes);
  if (biggest >= 12) return Math.min(rules.max_12yd_per_load, rules.max_skips_on_empty_vehicle);
  if (biggest >= 8) return Math.min(rules.max_8yd_per_load, rules.max_skips_on_empty_vehicle);
  return Math.min(rules.max_skips_per_load, rules.max_skips_on_empty_vehicle);
}

export function planDay(
  jobs: PlannerJob[],
  drivers: PlannerDriver[],
  rules: RoutingRules,
  ctx?: TravelContext,
): RoutePlan {
  const warnings: string[] = [];

  // Duplicate registrations
  const regCount = new Map<string, string[]>();
  for (const d of drivers) {
    const reg = norm(d.registration).replace(/\s+/g, "");
    if (!reg) continue;
    if (!regCount.has(reg)) regCount.set(reg, []);
    regCount.get(reg)!.push(d.name);
  }
  for (const [reg, names] of regCount) {
    if (names.length > 1) {
      warnings.push(`${names.join(" and ")} are both set up on registration ${reg.toUpperCase()} — only one driver per vehicle.`);
    }
  }

  const hasWork = (d: PlannerDriver) =>
    jobs.some(j => j.currentDriverId === d.id || (j.currentDriverName && norm(j.currentDriverName) === norm(d.name)));

  const working = rules.idle_drivers_not_working ? drivers.filter(hasWork) : drivers.slice();
  const notWorking = drivers.filter(d => !working.includes(d));

  for (const d of working) {
    if (!d.registration) warnings.push(`${d.name} has jobs today but no vehicle assigned — give them a vehicle in Setup.`);
  }

  const laneDrivers = new Map<Lane, PlannerDriver[]>([["skip", []], ["roro", []], ["artic", []]]);
  for (const d of working) {
    const lane = laneForDriver(d, rules);
    if (lane) laneDrivers.get(lane)!.push(d);
  }

  const unplanned: { job: PlannerJob; reason: string }[] = [];
  const buckets = new Map<Lane, PlannerJob[]>([["skip", []], ["roro", []], ["artic", []]]);
  for (const job of jobs) {
    const lane = laneForJob(job, rules);
    if (!lane || laneDrivers.get(lane)!.length === 0) {
      unplanned.push({
        job,
        reason: lane
          ? `No working ${lane === "roro" ? "Ro-Ro" : lane} vehicle available for this container.`
          : `Container type "${job.containerType || "unknown"}" could not be matched to a vehicle type.`,
      });
      continue;
    }
    buckets.get(lane)!.push(job);
  }

  const plans: DriverPlan[] = working.map(d => ({
    driver: d,
    lane: (laneForDriver(d, rules) ?? "skip") as Lane,
    jobs: [],
    totalMinutes: 0,
  }));

  const dayCap = rules.day_length_hours * 60;

  for (const lane of ["skip", "roro", "artic"] as Lane[]) {
    const laneJobs = sequence(buckets.get(lane)!);
    const pool = plans.filter(p => p.lane === lane);
    if (pool.length === 0) continue;

    let trip: PlannerJob[] = [];
    const flushInto = (target: DriverPlan, group: PlannerJob[]) => {
      for (const job of group) {
        const travel = target.jobs.length === 0 ? rules.mins_travel : rules.mins_travel;
        const work = minutesForMovement(job.movement, rules);
        const start = target.totalMinutes + travel;
        const end = start + work;
        const movedFromName = job.currentDriverName || null;
        const moved = norm(movedFromName) !== norm(target.driver.name);
        target.jobs.push({
          job,
          start: fmt(rules.day_start, start),
          end: fmt(rules.day_start, end),
          movedFrom: moved ? movedFromName : null,
          reason: moved
            ? movedFromName
              ? `Moved from ${movedFromName} to balance the day and keep ${outward(job.postcode).toUpperCase() || "this area"} work together.`
              : `Assigned to ${target.driver.name} — ${lane === "roro" ? "Ro-Ro" : lane} vehicle, ${outward(job.postcode).toUpperCase() || "no postcode"}.`
            : `Kept with ${target.driver.name}, resequenced with other ${outward(job.postcode).toUpperCase() || "local"} work.`,
        });
        target.totalMinutes = end;
        if (target.totalMinutes > dayCap / 2 && target.totalMinutes - work <= dayCap / 2) {
          target.totalMinutes += rules.mins_break;
        }
      }
    };

    const nextDriver = () => pool.reduce((a, b) => (a.totalMinutes <= b.totalMinutes ? a : b));

    const groups: PlannerJob[][] = [];
    for (const job of laneJobs) {
      const isDelivery = norm(job.movement).includes("deliver");
      const perTrip = lane === "roro" ? rules.roro_containers_per_trip : skipLoadCapacity([...trip, job], rules);
      const sameArea = trip.length === 0 || outward(trip[0].postcode) === outward(job.postcode);
      const canGroup =
        lane === "skip" &&
        isDelivery &&
        sameArea &&
        trip.every(t => norm(t.movement).includes("deliver")) &&
        trip.length + 1 <= perTrip;
      if (canGroup) {
        trip.push(job);
        continue;
      }
      if (trip.length) groups.push(trip);
      trip = [job];
    }
    if (trip.length) groups.push(trip);

    for (const group of groups) flushInto(nextDriver(), group);
  }

  for (const p of plans) {
    if (p.totalMinutes > dayCap) {
      warnings.push(`${p.driver.name}'s day runs to about ${Math.round(p.totalMinutes / 60)} hours, over the ${rules.day_length_hours}-hour limit.`);
    }
  }

  return {
    drivers: plans.filter(p => p.jobs.length > 0 || working.includes(p.driver)),
    unplanned,
    warnings,
    notWorking,
  };
}
