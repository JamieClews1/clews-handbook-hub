import type { RoutingRules } from "@/hooks/useRoutingRules";
import { travelMinutes, type TravelContext } from "@/lib/route-planner";

export const STANDARD_DRIVER_DAY_HOURS = 10;
export const STANDARD_DRIVER_BREAK_MINUTES = 45;
export type DayEstimateJob = { postcode: string; movement: string; durationMinutes?: number | null };

/** Read-only estimate in displayed order. Never sequences or assigns jobs. */
export function estimateDriverDay(jobs: DayEstimateJob[], rules: RoutingRules, context?: TravelContext) {
  const distanceRules = { ...rules, travel_model: "distance" as const };
  let location = rules.yard_postcode;
  let travel = 0;
  let handling = 0;
  let fallbackLegs = 0;
  let legs = 0;
  const addLeg = (to: string) => {
    // No journey is needed if already back at the yard.
    if (location && to && location.toUpperCase().replace(/\s/g, "") === to.toUpperCase().replace(/\s/g, "")) return;
    const leg = travelMinutes(location, to, distanceRules, context);
    travel += leg.minutes;
    legs++;
    if (!leg.basis.includes("miles at")) fallbackLegs++;
    location = to;
  };
  for (const job of jobs) {
    const movement = job.movement.toLowerCase();
    const exchange = /exchange|swap|tip.*return/.test(movement);
    const collect = /collect|pickup|pick.up|removal|uplift/.test(movement);
    const returnsLoaded = exchange || collect || /waste|tip/.test(movement);
    addLeg(job.postcode);
    handling += job.durationMinutes && job.durationMinutes > 0 ? job.durationMinutes
      : exchange ? rules.mins_exchange : collect ? rules.mins_collection : rules.mins_delivery;
    if (returnsLoaded) {
      addLeg(rules.yard_postcode);
      handling += rules.mins_tipping;
    }
  }
  if (jobs.length) addLeg(rules.yard_postcode);
  const breakMinutes = jobs.length ? rules.mins_break : 0;
  const totalMinutes = travel + handling + breakMinutes;
  const limitMinutes = rules.day_length_hours * 60;
  const ratio = limitMinutes > 0 ? totalMinutes / limitMinutes : 0;
  return { totalMinutes, travelMinutes: travel, handlingMinutes: handling, breakMinutes, limitMinutes, fallbackLegs, legs,
    percent: Math.min(100, ratio * 100), tone: ratio > 0.9 ? "over" : ratio >= 0.75 ? "busy" : "available",
    remainingMinutes: Math.max(0, limitMinutes - totalMinutes), showRoom: ratio < 0.6 };
}
export function dayTime(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60).toString().padStart(2, "0")}m`;
}