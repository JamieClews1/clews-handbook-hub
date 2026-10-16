type Zone = { zone_name: string; postcodes: string[] };

/** Match exact postcode, sector, then district; never guess an unconfigured zone. */
export function matchQuotePostcodeZone(postcode: string | null, zones: Zone[]): string | null {
  if (!postcode) return null;
  const pc = postcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const full = pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/);
  const sector = pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d)$/);
  const candidates = full
    ? [pc, `${full[1]}${full[2][0]}`, full[1]]
    : sector ? [pc, sector[1]] : [pc];
  for (const candidate of candidates) {
    const zone = zones.find(z => z.postcodes.some(prefix =>
      prefix.toUpperCase().replace(/[^A-Z0-9]/g, "") === candidate
    ));
    if (zone) return zone.zone_name;
  }
  return null;
}