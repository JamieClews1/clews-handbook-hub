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
