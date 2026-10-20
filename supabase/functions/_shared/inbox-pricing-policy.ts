/** Inbox drafts use Trade unless the customer explicitly asks for residential rates. */
export function inboxDraftRateCard(request: string, isRoRo: boolean): string {
  const residentialRequested = /\b(?:residential|cash)\s+(?:skip\s+)?(?:rates?|prices?|pricing|quote)\b/i.test(request);
  return residentialRequested && !isRoRo ? 'Residential Skip Rates 2026' : 'Trade Rates 2026';
}