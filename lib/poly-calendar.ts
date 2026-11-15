import Decimal from "decimal.js";
import { kyivDayKey } from "@/lib/day-pnl";
import { D } from "@/lib/money";
import { resultDate } from "@/lib/poly-stats";

export type PolyDay = { date: string; pnl: string; count: number };

/** Closed trades summed per Kyiv calendar day of their result, oldest day first. */
export function polyDays(
  trades: Array<{
    status: string;
    pnlUsd: string;
    openedAt: string;
    resolvedAt: string | null;
  }>,
): PolyDay[] {
  const days = new Map<string, { pnl: Decimal; count: number }>();
  for (const trade of trades) {
    if (trade.status === "OPEN") continue;
    const when = resultDate({
      openedAt: new Date(trade.openedAt),
      resolvedAt: trade.resolvedAt ? new Date(trade.resolvedAt) : null,
    });
    const key = kyivDayKey(when);
    const day = days.get(key) ?? { pnl: D(0), count: 0 };
    days.set(key, { pnl: day.pnl.plus(D(trade.pnlUsd)), count: day.count + 1 });
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      pnl: day.pnl.toDecimalPlaces(2).toString(),
      count: day.count,
    }));
}
