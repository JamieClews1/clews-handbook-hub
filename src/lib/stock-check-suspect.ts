// Suspect inventory profiles: not office verified and no "new" photo.
// Old photos were imported as ~244px thumbnails (under ~55 KB); real
// photos are 200 KB+. Anything under the threshold, or whose size is
// unknown, counts as old so a profile is never cleared by a guess.
export const THUMBNAIL_MAX_BYTES = 100_000;

/** Storage object path for a public bucket URL, e.g. "skip-tracker/x.jpg". */
export function photoPath(url: string, bucket = "contamination-photos"): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

export function hasNewPhoto(photos: string[] | null | undefined, sizes: Map<string, number>): boolean {
  return (photos || []).some((url) => {
    const path = photoPath(url);
    const size = path ? sizes.get(path) : undefined;
    return size !== undefined && size >= THUMBNAIL_MAX_BYTES;
  });
}

export function isSuspectProfile(
  row: { photos?: string[] | null; office_verified?: boolean | null },
  sizes: Map<string, number>,
): boolean {
  return !row.office_verified && !hasNewPhoto(row.photos, sizes);
}

/** Why a profile is on the Suspect list, or null when it isn't suspect. */
export function suspectReason(
  row: { photos?: string[] | null; office_verified?: boolean | null },
  sizes: Map<string, number>,
): "No photos" | "Old photos only" | null {
  if (isSuspectProfile(row, sizes)) {
    return (row.photos || []).length === 0 ? "No photos" : "Old photos only";
  }
  return null;
}

/** Fields the suspect export needs — any inventory profile row satisfies it. */
export interface SuspectExportRow {
  asset_number: string;
  asset_type: string;
  size?: string | null;
  condition?: string | null;
  tags?: string[] | null;
  photos?: string[] | null;
  last_location?: string | null;
  last_skiptrak_ticket?: string | null;
  last_cataloged_at?: string | null;
  last_reported_by?: string | null;
}

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV of suspect profiles: one row per bin, with the reason it was flagged. */
export function suspectCsv(rows: SuspectExportRow[], sizes: Map<string, number>): string {
  const head = [
    "Number",
    "Type",
    "Size",
    "Condition",
    "Tags",
    "Photos",
    "Why flagged",
    "Last location",
    "Skiptrak ticket",
    "Last catalogued",
    "Logged by",
  ];
  const lines = rows.map((r) =>
    [
      r.asset_number,
      r.asset_type === "roro" ? "RoRo" : "Skip",
      r.size || "",
      r.condition || "",
      (r.tags || []).join(", "),
      r.photos?.length || 0,
      suspectReason(r, sizes) || "",
      r.last_location || "",
      r.last_skiptrak_ticket || "",
      // Stored as ISO timestamps; the export only needs the day.
      (r.last_cataloged_at || "").slice(0, 10),
      r.last_reported_by || "",
    ]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\n");
}
