import Decimal from "decimal.js";
import type { PolySectionKey } from "@/lib/poly-stats";

/** One point of the per-source running PnL: the moment a trade got its result and every source's total at that moment. */
export type SourcePoint = { t: number } & Record<PolySectionKey, number>;

type ClosedLike = { section: PolySectionKey; status: string; pnlUsd: string; openedAt: string; resolvedAt: string | null };

/**
 * Running PnL of each source over time, on the same result date the top PnL chart uses (resolvedAt, else openedAt).
 * Every row carries all sources, so a source without a trade at that moment stays flat instead of jumping.
 * The first row is zero for everyone, so every line starts from 0 rather than from its first result.
 */
export function sourceSeries(trades: ClosedLike[], keys: PolySectionKey[]): SourcePoint[] {
  const closed = trades
    .filter((trade) => trade.status !== "OPEN" && keys.includes(trade.section))
    .map((trade) => ({ trade, t: new Date(trade.resolvedAt ?? trade.openedAt).getTime() }))
    .sort((a, b) => a.t - b.t);
  if (!closed.length) return [];
  const running = Object.fromEntries(keys.map((key) => [key, new Decimal(0)])) as Record<PolySectionKey, Decimal>;
  const snapshot = (t: number) => ({ t, ...Object.fromEntries(keys.map((key) => [key, running[key].toNumber()])) }) as SourcePoint;
  const points: SourcePoint[] = [snapshot(closed[0].t)];
  for (const { trade, t } of closed) {
    running[trade.section] = running[trade.section].plus(trade.pnlUsd);
    // Trades settled in the same millisecond collapse into one point.
    if (points.length > 1 && points.at(-1)!.t === t) points[points.length - 1] = snapshot(t);
    else points.push(snapshot(t));
  }
  return points;
}
