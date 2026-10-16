import { computeOverRentalBins, type OverRentalBin, type OverRentalJob } from "./overRental";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

export type RentalCoverage = {
  customer: string | null;
  site: string | null;
  container_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  rental_mode: string;
};

const norm = (value: string | null) => (value ?? "").trim().toLowerCase();

export function agreementCoversBin(agreement: RentalCoverage, bin: OverRentalBin, today = new Date().toISOString().slice(0, 10)): boolean {
  return agreement.status === "active"
    && (!agreement.start_date || agreement.start_date <= today)
    && (!agreement.end_date || agreement.end_date >= today)
    && norm(agreement.customer) === norm(bin.customer)
    && (!agreement.site || norm(agreement.site) === norm(bin.site))
    && (!agreement.container_type || norm(agreement.container_type) === norm(bin.containerType));
}

export function agreedRentalRate(mode: string, rate: number | null): number | null {
  return mode === "no_rental" ? 0 : rate;
}

// Reuse the shared physical container balance, including the free period and day zero.
// This is tracking only: the chase list retains its normal free-period settings.
export function trackedAgreementBins(jobs: OverRentalJob[], settings: LiveJobsSettings): OverRentalBin[] {
  return computeOverRentalBins(jobs, { ...settings, rental_free_days: -1 });
}