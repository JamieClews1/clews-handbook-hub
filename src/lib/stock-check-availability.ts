export function stockCheckAvailability(tally: { in_yard: number; runner: number } | undefined, toDeliver: number) {
  const inYard = tally?.in_yard ?? 0;
  return { inYard, bookingsAllowed: tally ? inYard - toDeliver - tally.runner : 0 };
}