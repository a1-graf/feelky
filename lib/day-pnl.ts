import type Decimal from "decimal.js";
import { kyivStamp } from "@/lib/agent-query";
import { D } from "@/lib/money";
import { recentDates } from "@/lib/telegram/dates";

/** One Kyiv calendar day of a sphere's result; `pnl` is a decimal string. */
export type DayPnlPoint = { date: string; pnl: string };

export const DAY_PNL_DAYS = 7;

/** Kyiv calendar day (`YYYY-MM-DD`) an instant belongs to. */
export const kyivDayKey = (date: Date) => kyivStamp(date).slice(0, 10);

/**
 * Last `days` Kyiv days (oldest first, today last) with the summed result of each day.
 * Days without results are kept as zero so every sphere shows the same calendar.
 */
export function lastDaysPnl(entries: Iterable<{ date: string; pnl: Decimal.Value }>, days = DAY_PNL_DAYS, now: Date = new Date()): DayPnlPoint[] {
  const keys = recentDates(days, now).reverse();
  const sums = new Map<string, Decimal>(keys.map((key) => [key, D(0)]));
  for (const entry of entries) {
    const current = sums.get(entry.date);
    if (current) sums.set(entry.date, current.plus(D(entry.pnl)));
  }
  return keys.map((date) => ({ date, pnl: (sums.get(date) as Decimal).toDecimalPlaces(2).toString() }));
}
