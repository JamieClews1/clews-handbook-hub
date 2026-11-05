export interface StockMovement {
  id: string;
  job_number: string;
  source: 'skiptrak' | 'routeone';
  container_type: string | null;
  movement_type: string | null;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  ewc: string | null;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string | null;
}

export function movementAfterTally(job: StockMovement, baseline: string, baselineDay: string) {
  if (!job.completed) return false;
  // Native jobs carry actual completion time. Imports only carry upload time,
  // so require both a post-tally upload and a job date within the tally window.
  if (job.completedAt) return Date.parse(job.completedAt) > Date.parse(baseline);
  return Boolean(job.job_date && job.job_date >= baselineDay && job.updatedAt && Date.parse(job.updatedAt) > Date.parse(baseline));
}

export function stockMovementDelta(movement: string | null) {
  const value = (movement ?? '').toLowerCase();
  if (value.includes('exchange') || value.includes('tip/return')) return 0;
  if (value.includes('collect')) return 1;
  if (value.includes('deliver')) return -1;
  return 0;
}

export function stockContainerKey(value: string) {
  return value.toLowerCase().replace(/\byards?\b/g, 'yd').replace(/\benc\b/g, 'enclosed').replace(/(\d)\s+yd/g, '$1yd').replace(/\s*\/\s*/g, '/').replace(/[^a-z0-9/]+/g, ' ').trim();
}

export function uniqueStockMovements(jobs: StockMovement[]) {
  const nativeNumbers = new Set(jobs.filter(j => j.source === 'routeone').map(j => j.job_number.trim().toUpperCase()));
  return jobs.filter(j => j.source !== 'skiptrak' || !nativeNumbers.has(j.job_number.trim().toUpperCase()));
}

export function stockCheckAvailability(tally: { in_yard: number; runner: number } | undefined, toDeliver: number, completedDelta = 0, toCollect = 0) {
  const inYard = (tally?.in_yard ?? 0) + completedDelta;
  return { inYard, bookingsAllowed: tally ? inYard + toCollect - toDeliver - tally.runner : 0 };
}