export const siteText = (raw: Record<string, unknown> | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

/** Location is the tipping depot, never the customer's service address. */
export function importedSiteDetails(raw: Record<string, unknown> | null | undefined, postcode = "") {
  const numbered = [
    siteText(raw, ["Address 1"]), siteText(raw, ["Address 2", "Address 2nd LIne"]),
    siteText(raw, ["Address 3"]), siteText(raw, ["Address 3_1"]),
    siteText(raw, ["Address 4"]), siteText(raw, ["Address 5"]),
  ].filter(Boolean);
  return {
    address: [...new Set(numbered)].join("\n") || siteText(raw, ["Site Address", "Site address", "Address"]),
    postcode: postcode || siteText(raw, ["Location Postc", "Location Postcode", "Postcode"]),
    area: siteText(raw, ["Area"]), contact: siteText(raw, ["Contact"]),
    phone: siteText(raw, ["Contact mobile", "Contact Phone"]), sic: siteText(raw, ["SIC Code"]),
  };
}

export type BookingSite = { name: string; address: string; postcode: string; area?: string; contact?: string; phone?: string; sic?: string };

export function applyBookingSite(form: any, site: BookingSite) {
  return { ...form, site_name: site.name, site_address: site.address, site_address_2: "",
    site_postcode: site.postcode, site_area: site.area || "", site_contact_name: site.contact || "",
    site_contact_phone: site.phone || "", sic_code: site.sic || "", directions: "" };
}