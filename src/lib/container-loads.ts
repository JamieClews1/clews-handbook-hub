// Shared types and helpers for the Container Loads (export) feature.

export type ContainerStatus = "prepping" | "loaded" | "paperwork_ready" | "exported";

export interface PackingRow {
  bale_no: string;
  material: string;
  weight_kg: number | null;
  notes?: string;
}

export type PhotoCategory =
  | "cab_reg"
  | "trailer_number"
  | "empty_trailer"
  | "half_loaded"
  | "fully_loaded"
  | "other";

export const PHOTO_REQUIREMENTS: { key: PhotoCategory; label: string; hint: string }[] = [
  { key: "cab_reg", label: "Front of cab", hint: "Showing vehicle registration number" },
  { key: "trailer_number", label: "Trailer number", hint: "Trailer visibly showing trailer number" },
  { key: "empty_trailer", label: "Empty trailer", hint: "Full trailer empty with curtain pulled back" },
  { key: "half_loaded", label: "Half loaded", hint: "Half full stages of loading the material" },
  { key: "fully_loaded", label: "Fully loaded", hint: "All material fully loaded, curtain pulled back" },
];

export interface ContainerPhoto {
  path: string;
  url: string;
  caption?: string;
  uploaded_at?: string;
  category?: PhotoCategory;
}


export interface Annex7Fields {
  // 1. Person who arranges the shipment (exporter)
  exporter_name?: string;
  exporter_address?: string;
  exporter_contact?: string;
  exporter_tel?: string;
  exporter_email?: string;
  // 2. Importer / consignee
  consignee_name?: string;
  consignee_address?: string;
  consignee_contact?: string;
  consignee_tel?: string;
  consignee_email?: string;
  // 5. Carrier
  carrier_name?: string;
  carrier_address?: string;
  carrier_contact?: string;
  means_of_transport?: string;
  // 6-8. Countries
  country_dispatch?: string;
  country_transit?: string;
  country_destination?: string;
  // 11. Recovery facility
  recovery_facility_name?: string;
  recovery_facility_address?: string;
  recovery_operation?: string; // e.g. R3
  // misc
  contract_number?: string;
}

export type PaperworkMode = "create" | "upload";

export interface PaperworkFile {
  path: string;
  url: string;
  name?: string;
  uploaded_at?: string;
}

export interface ContainerLoad {
  paperwork_mode: PaperworkMode;
  annex7_upload: PaperworkFile | null;
  packing_upload: PaperworkFile | null;
  supplier_email: string | null;
  sent_at: string | null;
  id: string;
  reference: string | null;
  status: ContainerStatus;
  customer_id: string | null;
  customer_name: string | null;
  container_number: string | null;
  seal_number: string | null;
  material: string | null;
  ewc_code: string | null;
  basel_code: string | null;
  bale_count: number;
  total_weight_t: number | null;
  destination_country: string | null;
  destination_facility: string | null;
  export_date: string | null;
  booking_reference: string | null;
  vessel: string | null;
  photos: ContainerPhoto[];
  packing: PackingRow[];
  annex7: Annex7Fields;
  notes: string | null;
  operator_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTAINER_STATUS_META: Record<
  ContainerStatus,
  { label: string; badgeClass: string; order: number }
> = {
  prepping: {
    label: "Prepping",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    order: 0,
  },
  loaded: {
    label: "Loaded",
    badgeClass:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    order: 1,
  },
  paperwork_ready: {
    label: "Paperwork ready",
    badgeClass:
      "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
    order: 2,
  },
  exported: {
    label: "Exported / Shipped",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    order: 3,
  },
};

export const CONTAINER_STATUS_ORDER: ContainerStatus[] = [
  "prepping",
  "loaded",
  "paperwork_ready",
  "exported",
];

/** Normalise a raw row from the database into a typed ContainerLoad. */
export function normalizeContainerLoad(row: any): ContainerLoad {
  return {
    ...row,
    status: (row.status ?? "prepping") as ContainerStatus,
    bale_count: row.bale_count ?? 0,
    photos: Array.isArray(row.photos) ? (row.photos as ContainerPhoto[]) : [],
    packing: Array.isArray(row.packing) ? (row.packing as PackingRow[]) : [],
    annex7: (row.annex7 && typeof row.annex7 === "object" ? row.annex7 : {}) as Annex7Fields,
    paperwork_mode: (row.paperwork_mode ?? "create") as PaperworkMode,
    annex7_upload: (row.annex7_upload ?? null) as PaperworkFile | null,
    packing_upload: (row.packing_upload ?? null) as PaperworkFile | null,
  };
}

export function packingTotalKg(packing: PackingRow[]): number {
  return packing.reduce((sum, r) => sum + (Number(r.weight_kg) || 0), 0);
}
