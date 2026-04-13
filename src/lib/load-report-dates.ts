import { format } from "date-fns";

export function parseLoadReportDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    const result = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      result.getUTCFullYear() !== Number(year) ||
      result.getUTCMonth() !== Number(month) - 1 ||
      result.getUTCDate() !== Number(day)
    ) {
      return null;
    }
    return result;
  }

  const dmy = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmy) {
    let [, day, month, year] = dmy;
    const parsedYear = Number(year.length === 2 ? `20${year}` : year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);
    const result = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));

    if (
      result.getUTCFullYear() !== parsedYear ||
      result.getUTCMonth() !== parsedMonth - 1 ||
      result.getUTCDate() !== parsedDay
    ) {
      return null;
    }

    return result;
  }

  return null;
}

export function formatLoadReportDate(
  dateStr: string | null | undefined,
  dateFormat: string,
): string {
  const parsedDate = parseLoadReportDate(dateStr);
  if (!parsedDate) return dateStr ?? "";
  return format(parsedDate, dateFormat);
}

export function normalizeLoadReportDate(dateStr: string | null | undefined): string {
  const parsedDate = parseLoadReportDate(dateStr);
  return parsedDate ? format(parsedDate, "yyyy-MM-dd") : "";
}

export function getTodayLoadReportDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}
