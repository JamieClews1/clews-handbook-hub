import { binWasteTypeLabel, type OverRentalBin } from "./overRental";

export { binWasteTypeLabel };
export type { OverRentalBin };

// Weekly rental cost label for a bin, based on its category and the configured rates.
export function rentalRateLabel(bin: OverRentalBin, skipRate: number, roroRate: number): string {
  const rate = bin.category === "roro" ? roroRate : skipRate;
  return `£${rate.toFixed(2)} + VAT per week`;
}

// Site name followed by its postcode, e.g. "Solutions Ltd, NN11 7HJ".
export function siteWithPostcode(bin: OverRentalBin): string {
  const pc = (bin.postcode ?? "").trim().toUpperCase();
  if (!pc || bin.site.toUpperCase().replace(/\s/g, "").includes(pc.replace(/\s/g, ""))) return bin.site;
  return `${bin.site}, ${pc}`;
}

// Fill the chase email template placeholders with this bin's details.
export function renderChaseTemplate(
  template: string,
  bin: OverRentalBin,
  freeDays: number,
  rateLabel: string,
): string {
  return (template || DEFAULT_CHASE_EMAIL_TEMPLATE)
    .split("{customer}").join(bin.customer)
    .split("{site}").join(siteWithPostcode(bin))
    .split("{containerType}").join(bin.containerType)
    .split("{wasteType}").join(binWasteTypeLabel(bin))
    .split("{days}").join(String(bin.daysSinceActivity ?? ""))
    .split("{freeDays}").join(String(freeDays))
    .split("{rate}").join(rateLabel);
}

import { DEFAULT_CHASE_EMAIL_TEMPLATE } from "@/hooks/useLiveJobsSettings";
