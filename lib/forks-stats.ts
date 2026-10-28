import Decimal from "decimal.js";
import { kyivStamp } from "@/lib/agent-query";
import { bagiraFee, netOf } from "@/lib/forks-config";
import { D } from "@/lib/money";

/** Pure statistics of arbitrage forks: no database, every figure is unit-testable. */

export type ForkLike = {
  id: string;
  status: "OPEN" | "SETTLED";
  placedAt: Date;
  match: string;
  sport?: string | null;
  tags?: string[];
  leg1Book: string;
  leg1Pick: string;
  leg1Odds: Decimal.Value;
  leg1Stake: Decimal.Value;
  leg2Book: string;
  leg2Pick: string;
  leg2Odds: Decimal.Value;
  leg2Stake: Decimal.Value;
  total: Decimal.Value;
  pnl?: Decimal.Value | null;
  guaranteed?: Decimal.Value | null;
};

export { bagiraFee, netOf };
const ZERO = new Decimal(0);
const places = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();

const isSettled = (fork: ForkLike): fork is ForkLike & { pnl: Decimal.Value } => fork.status === "SETTLED" && fork.pnl != null;

export function forkPercent(fork: Pick<ForkLike, "pnl" | "total">): Decimal | null {
  const total = D(fork.total);
  return fork.pnl != null && total.gt(0) ? D(fork.pnl).div(total).mul(100) : null;
}

/** Kyiv calendar day (YYYY-MM-DD) of a fork. */
export const forkDay = (fork: Pick<ForkLike, "placedAt">) => kyivStamp(fork.placedAt).slice(0, 10);

/** Monday of the week the day falls in. */
export function weekStart(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  const shift = (utc.getUTCDay() + 6) % 7;
  return new Date(utc.getTime() - shift * 86_400_000).toISOString().slice(0, 10);
}

type Bucket = { count: number; wins: number; losses: number; pnl: Decimal; turnover: Decimal };
const emptyBucket = (): Bucket => ({ count: 0, wins: 0, losses: 0, pnl: ZERO, turnover: ZERO });
function addTo(bucket: Bucket, pnl: Decimal, total: Decimal) {
  bucket.count += 1;
  if (pnl.gt(0)) bucket.wins += 1;
  if (pnl.lt(0)) bucket.losses += 1;
  bucket.pnl = bucket.pnl.plus(pnl);
  bucket.turnover = bucket.turnover.plus(total);
}

function dynamics(map: Map<string, Bucket>, label: (key: string) => string) {
  let running = ZERO;
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => {
      running = running.plus(bucket.pnl);
      return {
        key,
        label: label(key),
        count: bucket.count,
        wins: bucket.wins,
        losses: bucket.losses,
        pnl: places(bucket.pnl),
        net: places(netOf(bucket.pnl)),
        turnover: places(bucket.turnover),
        cumulative: places(running)
      };
    });
}

const dayLabel = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

export function summarizeForks(forks: ForkLike[]) {
  const settled = forks.filter(isSettled);
  const open = forks.filter((fork) => fork.status === "OPEN");

  const total = emptyBucket();
  const byDay = new Map<string, Bucket>();
  const byWeek = new Map<string, Bucket>();
  let percentSum = ZERO;
  let percentCount = 0;
  let best: (typeof settled)[number] | null = null;
  let worst: (typeof settled)[number] | null = null;

  for (const fork of settled) {
    const pnl = D(fork.pnl);
    const stake = D(fork.total);
    addTo(total, pnl, stake);
    const day = forkDay(fork);
    if (!byDay.has(day)) byDay.set(day, emptyBucket());
    addTo(byDay.get(day) as Bucket, pnl, stake);
    const week = weekStart(day);
    if (!byWeek.has(week)) byWeek.set(week, emptyBucket());
    addTo(byWeek.get(week) as Bucket, pnl, stake);
    const percent = forkPercent(fork);
    if (percent) {
      percentSum = percentSum.plus(percent);
      percentCount += 1;
    }
    if (!best || pnl.gt(D(best.pnl))) best = fork;
    if (!worst || pnl.lt(D(worst.pnl))) worst = fork;
  }

  const fee = bagiraFee(total.pnl);
  const extreme = (fork: (typeof settled)[number] | null) => (fork ? { match: fork.match, pnl: places(D(fork.pnl)), placedAt: fork.placedAt.toISOString() } : null);

  let running = ZERO;
  const timeline = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => {
      running = running.plus(bucket.pnl);
      const dayPnl = bucket.pnl;
      return { date, label: dayLabel(date), profit: dayPnl.gt(0) ? dayPnl.toNumber() : 0, loss: dayPnl.lt(0) ? dayPnl.abs().toNumber() : 0, net: running.toNumber() };
    });

  const sortDesc = (a: ForkLike, b: ForkLike) => b.placedAt.getTime() - a.placedAt.getTime();
  const serialize = (fork: ForkLike) => ({
    id: fork.id,
    status: fork.status,
    placedAt: fork.placedAt.toISOString(),
    match: fork.match,
    sport: fork.sport ?? null,
    tags: fork.tags ?? [],
    legs: [
      { book: fork.leg1Book, pick: fork.leg1Pick, odds: D(fork.leg1Odds).toString(), stake: D(fork.leg1Stake).toString() },
      { book: fork.leg2Book, pick: fork.leg2Pick, odds: D(fork.leg2Odds).toString(), stake: D(fork.leg2Stake).toString() }
    ],
    total: D(fork.total).toString(),
    pnl: fork.pnl == null ? null : D(fork.pnl).toString(),
    percent: fork.pnl == null ? null : forkPercent(fork)?.toDecimalPlaces(2).toString() ?? null,
    guaranteed: fork.guaranteed == null ? null : D(fork.guaranteed).toString()
  });

  const openStake = open.reduce((sum, fork) => sum.plus(D(fork.total)), ZERO);
  const openGuaranteed = open.reduce((sum, fork) => sum.plus(D(fork.guaranteed ?? 0)), ZERO);

  return {
    count: total.count,
    wins: total.wins,
    losses: total.losses,
    winRate: total.wins + total.losses ? places(new Decimal(total.wins).div(total.wins + total.losses).mul(100)) : "0",
    pnl: places(total.pnl),
    turnover: places(total.turnover),
    avgPercent: percentCount ? places(percentSum.div(percentCount)) : "0",
    weightedPercent: total.turnover.gt(0) ? places(total.pnl.div(total.turnover).mul(100)) : "0",
    bagiraFee: places(fee),
    net: places(total.pnl.minus(fee)),
    best: extreme(best),
    worst: extreme(worst),
    byDay: dynamics(byDay, dayLabel).reverse(),
    byWeek: dynamics(byWeek, (key) => `${dayLabel(key)} – ${dayLabel(new Date(new Date(`${key}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10))}`).reverse(),
    timeline,
    open: { count: open.length, stake: places(openStake), guaranteed: places(openGuaranteed), items: open.sort(sortDesc).map(serialize) },
    settled: settled.sort(sortDesc).map(serialize)
  };
}

export type ForkSummary = ReturnType<typeof summarizeForks>;
export type ForkItem = ForkSummary["settled"][number];

export type ForkSeriesPoint = { t: number; balance: number; total: number; delta: number; kind: "fork"; label: string };

/** Running gross profit after every settled fork; `balance` and `total` are the same line, `total` also feeds the tooltip. */
export function buildForkSeries(forks: ForkLike[]): ForkSeriesPoint[] {
  let running = ZERO;
  return forks
    .filter(isSettled)
    .sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime())
    .map((fork) => {
      const pnl = D(fork.pnl);
      running = running.plus(pnl);
      return { t: fork.placedAt.getTime(), balance: running.toNumber(), total: running.toNumber(), delta: pnl.toNumber(), kind: "fork" as const, label: fork.match };
    });
}

/** `[from, to]` is inclusive; a fork is judged by the moment it was placed. */
export function inRange<T extends { placedAt: Date }>(forks: T[], range: { gte: Date; lte: Date }): T[] {
  return forks.filter((fork) => fork.placedAt >= range.gte && fork.placedAt <= range.lte);
}
