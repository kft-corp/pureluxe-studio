import { AppError } from "@pureluxe/shared";

/** YYYY-MM-DD, or MM-DD when the advisor gave no year. */
export const LOOSE_DATE = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/;

export type ResolvedDates = {
  start: string;
  end: string;
  /** No year was given; it was worked out from today. */
  yearAssumed: boolean;
};

function invalid(message: string): AppError {
  return new AppError({ userMessage: message, code: "trips.dates_invalid", status: 400 });
}

function parts(value: string): { year: number | null; month: number; day: number } {
  const match = LOOSE_DATE.exec(value.trim());
  if (!match) throw invalid(`"${value}" is not a date. Use YYYY-MM-DD or MM-DD.`);
  return {
    year: match[1] ? Number(match[1]) : null,
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw invalid(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} is not a real date.`);
  }
  return date.toISOString().slice(0, 10);
}

function monthDay(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Exact trip dates from what the advisor said. Without a year, the start is its
 * next occurrence from today, and an end before the start falls in the next year
 * ("28 Dec – 3 Jan").
 */
export function resolveTripDates(input: { start: string; end: string; today: string }): ResolvedDates {
  const start = parts(input.start);
  const end = parts(input.end);
  const todayYear = Number(input.today.slice(0, 4));
  const todayMonthDay = input.today.slice(5, 10);

  const startYear =
    start.year ?? (monthDay(start.month, start.day) >= todayMonthDay ? todayYear : todayYear + 1);
  const endYear =
    end.year ??
    (monthDay(end.month, end.day) > monthDay(start.month, start.day) ? startYear : startYear + 1);

  const resolved = {
    start: isoDate(startYear, start.month, start.day),
    end: isoDate(endYear, end.month, end.day),
    yearAssumed: start.year == null || end.year == null,
  };
  if (resolved.end <= resolved.start) {
    throw invalid(`The trip ends (${resolved.end}) before it starts (${resolved.start}).`);
  }
  return resolved;
}

/** One room per two adults, at least one. */
export function defaultRoomCount(adults: number): number {
  return Math.max(1, Math.ceil(adults / 2));
}
