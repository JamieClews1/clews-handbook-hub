/**
 * Map a recorded (Skiptrak) container description onto the booking form's
 * container group and stable pricing size code. Unrecognised wording returns the
 * original text with no size, so staff choose rather than a size being guessed.
 */
export function recordedContainerBooking(recorded: string | null | undefined): { container_type: string; container_size: string } {
  const raw = String(recorded ?? "").trim();
  const text = raw.toLowerCase().replace(/^\./, "");
  const yards = Number(text.match(/(\d+)\s*(?:yd|yard)/)?.[1] ?? text.match(/^(\d+)\b/)?.[1] ?? NaN);
  if (/ro\s*-?\s*ro|roll\s*on/.test(text)) {
    if (/compactor/.test(text)) return { container_type: "Ro Ro", container_size: "35yd_compactor" };
    if (/enclosed|\benc\b/.test(text)) return { container_type: "Ro Ro", container_size: "35yd_enclosed" };
    const size = yards === 20 ? "20yd_roro" : yards === 25 ? "25yd_roro" : yards === 35 || yards === 40 ? "40yd" : "";
    return { container_type: "Ro Ro", container_size: size };
  }
  if (/curtain/.test(text)) return { container_type: "Artic", container_size: "curtain" };
  if (/walking\s*floor/.test(text)) return { container_type: "Artic", container_size: "walking_floor" };
  if (/ejector/.test(text)) return { container_type: "Artic", container_size: "ejector" };
  if (/pick\s*-?\s*up|flat\s*bed/.test(text)) return { container_type: "Pickup", container_size: "pickup" };
  if (/compactor|wheelie|litre|dolav|ibc|bale|pallet|loose/.test(text)) return { container_type: raw, container_size: "" };
  if (/skip|yard|yd|chain\s*lift/.test(text) && Number.isFinite(yards)) {
    if (yards === 12 && /enc/.test(text)) return { container_type: "Skip", container_size: "12yd_enclosed" };
    const size = yards === 6 ? "6yd" : yards === 8 ? "8yd" : yards === 12 ? "12yd" : yards === 14 || yards === 16 ? "14_16yd" : "";
    return { container_type: "Skip", container_size: size };
  }
  return { container_type: raw, container_size: "" };
}
