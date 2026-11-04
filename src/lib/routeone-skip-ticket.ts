/** Copy booked waste facts without replacing them with a pricing-table label. */
export function routeOneSkipDetails(job: {
  site_name: string | null;
  site_address?: string | null;
  site_address_2?: string | null;
  site_postcode: string | null;
  waste_type: string | null;
  ewc_code: string | null;
}) {
  const parts: string[] = [];
  for (const value of [job.site_name, job.site_address, job.site_address_2, job.site_postcode]) {
    const text = value?.trim();
    if (text && !parts.some(p => p.toLowerCase().includes(text.toLowerCase()))) parts.push(text);
  }
  return { site: parts.join(", "), waste_description: job.waste_type?.trim() ?? "", ewc_code: job.ewc_code?.trim() ?? "" };
}