interface RegisterRecord {
  name: string;
  registrationNumber: string;
  postcode: string;
  address: string;
  facilityType: string;
  status: string;
  operator: string;
}

export interface RegisterResponse {
  records: RegisterRecord[];
  page: number;
  totalPages: number;
  attribution: string;
  facilityTypes: string[];
}

const pick = (rec: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

/** The register API shape is defensive-mapped so field renames upstream don't break the page. */
export function normaliseResponse(raw: any): RegisterResponse {
  const list: any[] = Array.isArray(raw?.results) ? raw.results
    : Array.isArray(raw?.records) ? raw.records
    : Array.isArray(raw?.data) ? raw.data : [];
  return {
    records: list.map((r) => ({
      name: pick(r, ["name", "site_name", "business_name", "company_name", "operator_name", "registration_name"]),
      registrationNumber: pick(r, ["registration_number", "permit_number", "permit", "licence_number", "registration", "number"]),
      postcode: pick(r, ["postcode", "post_code", "site_postcode"]),
      address: pick(r, ["address", "site_address", "full_address"]),
      facilityType: pick(r, ["facility_type", "facility", "type"]),
      status: pick(r, ["status", "permit_status", "registration_status"]),
      operator: pick(r, ["licence_holder", "operator", "operator_name", "company_name", "trading_name"]),
    })).filter((r) => r.name),
    page: Number(raw?.page) || 1,
    totalPages: Number(raw?.total_pages ?? raw?.totalPages) || 1,
    attribution: typeof raw?.attribution === "string" ? raw.attribution : "",
    facilityTypes: Array.isArray(raw?.facility_types)
      ? raw.facility_types.map((f: any) => typeof f === "string" ? f : typeof f?.facility_type === "string" ? f.facility_type : "").filter(Boolean)
      : [],
  };
}

