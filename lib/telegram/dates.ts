/**
 * Backdating support. Dates are picked from buttons, so the user never types one.
 * Everything is anchored to the Kyiv calendar day, matching how the site groups periods.
 */

import { KYIV_TIME_ZONE } from "@/lib/telegram/format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Current calendar day in Kyiv as `YYYY-MM-DD`. */
export function kyivToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/** Today first, then the previous days, as `YYYY-MM-DD`. */
export function recentDates(count = 14, now: Date = new Date()): string[] {
  const [year, month, day] = kyivToday(now).split("-").map(Number);
  const base = Date.UTC(year, month - 1, day);
  return Array.from({ length: count }, (_, index) => new Date(base - index * DAY_MS).toISOString().slice(0, 10));
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** `Сьогодні` / `Вчора` / `30.08` - short labels keep the buttons narrow. */
export function dateLabel(value: string, now: Date = new Date()): string {
  const dates = recentDates(2, now);
  if (value === dates[0]) return "Сьогодні";
  if (value === dates[1]) return "Вчора";
  const [, month, day] = value.split("-");
  return `${day}.${month}`;
}

/**
 * Today keeps the real timestamp so ordering stays natural. A past day is anchored to
 * midday UTC: that lands inside the same calendar day both in Kyiv and on a UTC server,
 * so a backdated entry can never slip into the neighbouring day or month.
 */
export function resolveTransactionDate(value: string | null | undefined, now: Date = new Date()): Date {
  if (!value || !isValidDateKey(value) || value === kyivToday(now)) return now;
  return new Date(`${value}T12:00:00.000Z`);
}

/** Accepts `30.08.2026`, `30/08/26`, `30.08` (current year) and `2026-08-30`. */
export function parseTypedDate(text: string, now: Date = new Date()): string | null {
  const clean = text.trim();
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean);
  if (ymd) return finalize(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  const dmy = /^(\d{1,2})[./\- ](\d{1,2})(?:[./\- ](\d{2,4}))?$/.exec(clean);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const rawYear = dmy[3];
  const currentYear = Number(kyivToday(now).slice(0, 4));
  let year = currentYear;
  if (rawYear) year = rawYear.length <= 2 ? 2000 + Number(rawYear) : Number(rawYear);
  return finalize(year, month, day);
}

function finalize(year: number, month: number, day: number): string | null {
  const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidDateKey(key) ? key : null;
}
