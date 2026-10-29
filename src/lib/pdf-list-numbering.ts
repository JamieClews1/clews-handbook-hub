/** Keep an explicit step number instead of adding a second list marker. */
export function numberedPdfItem(text: string, position = 1): string {
  const trimmed = text.trim();
  return /^\d+[.)](?:\s|$)/u.test(trimmed) ? trimmed : `${position}.  ${trimmed}`;
}