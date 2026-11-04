import { format } from "date-fns";

/**
 * Signature capture times for WeighOne tickets.
 *
 * A signature keeps the time it was first drawn; re-signing (a different image)
 * stamps a fresh time, and clearing the signature clears the time with it.
 */

type PreviousSignoff = { image?: string | null; at?: string | null } | null | undefined;

/** ISO time for the signature now on the form, or null when there is no signature. */
export function signoffAt(nextImage: string | null | undefined, previous?: PreviousSignoff): string | null {
  if (!nextImage) return null;
  if (previous && previous.image === nextImage && previous.at) return previous.at;
  return new Date().toISOString();
}

/** "Signed 04/11/2026 16:51" — empty when the signature carries no recorded time. */
export function signatureStamp(at?: string | null): string {
  if (!at) return "";
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "";
  return `Signed ${format(when, "dd/MM/yyyy HH:mm")}`;
}

/**
 * Markup for one printed signature box: the drawn image plus its small date/time.
 * Returns "" when nothing was signed, so the box stays blank.
 */
export function signaturePrintMarkup(
  image: string | null | undefined,
  at: string | null | undefined,
  alt: string,
): string {
  if (!image) return "";
  const stamp = signatureStamp(at);
  return `<img class="sig" src="${image}" alt="${alt}" />${stamp ? `<div class="when">${stamp}</div>` : ""}`;
}
