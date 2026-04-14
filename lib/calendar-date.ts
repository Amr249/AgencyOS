import { format, parse } from "date-fns";

/** Local calendar day as YYYY-MM-DD (never use `toISOString().slice(0, 10)` for this). */
export function formatCalendarDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a stored date-only value into local midnight for that calendar day.
 * Accepts `YYYY-MM-DD` or a longer ISO string (first 10 chars are used).
 */
export function parseCalendarDate(value: string): Date {
  const ymd = value.trim().slice(0, 10);
  return parse(ymd, "yyyy-MM-dd", new Date());
}
