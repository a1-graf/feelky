import Decimal from "decimal.js";
import { kyivStamp } from "@/lib/agent-query";
import { D } from "@/lib/money";
import { kyivToday } from "@/lib/telegram/dates";

/** Pure Polymarket statistics: no database, so every figure here is unit-testable. */

export type PolySectionKey = "MANUAL" | "COPYTRADE" | "AI_AGENT";
export type PolyStatusKey = "OPEN" | "WON" | "LOST" | "VOID";
export type PolyMarketKindKey = "BTC_5M" | "BTC_15M" | "ETH_5M" | "ETH_15M" | "OTHER";

export const POLY_SECTIONS: PolySectionKey[] = ["MANUAL", "COPYTRADE", "AI_AGENT"];
export const POLY_MARKET_KINDS: PolyMarketKindKey[] = ["BTC_5M", "BTC_15M", "ETH_5M", "ETH_15M", "OTHER"];

export const POLY_SECTION_LABELS: Record<PolySectionKey, string> = {
  MANUAL: "Вручну",
  COPYTRADE: "Копітрейд",
  AI_AGENT: "AI-агенти"
};

export type PolyTradeLike = {
  id: string;
  externalId: string;
  section: PolySectionKey;
  agentName?: string | null;
  marketSlug: string;
  title: string;
  marketKind: PolyMarketKindKey;
  outcome: string;
  entryPrice: Decimal.Value;
  sizeUsd: Decimal.Value;
  shares?: Decimal.Value | null;
  feesUsd?: Decimal.Value | null;
  status: PolyStatusKey;
  pnlUsd: Decimal.Value;
  openedAt: Date;
  resolvedAt?: Date | null;
  signalPrice?: Decimal.Value | null;
};

const ZERO = new Decimal(0);

/** Guess the market kind from a Polymarket slug such as "btc-updown-5m-1760000000". */
export function inferMarketKind(slug: string, title = ""): PolyMarketKindKey {
  const text = `${slug} ${title}`.toLowerCase();
  const asset = /\b(btc|bitcoin)\b|btc-|bitcoin/.test(text) ? "BTC" : /\b(eth|ethereum)\b|eth-|ethereum/.test(text) ? "ETH" : null;
  if (!asset) return "OTHER";
  if (/(^|[^0-9])5m([^a-z0-9]|$)|(?<![0-9])5-?min/.test(text)) return asset === "BTC" ? "BTC_5M" : "ETH_5M";
  if (/(^|[^0-9])15m([^a-z0-9]|$)|(?<![0-9])15-?min/.test(text)) return asset === "BTC" ? "BTC_15M" : "ETH_15M";
  return "OTHER";
}

/**
 * Net result of a resolved trade. WON pays 1 per share (shares = size / entry price), LOST loses the stake,
 * VOID returns it. Fees come off in every case; an open trade has no result yet.
 */
export function computePolyPnl(input: {
  status: PolyStatusKey;
  entryPrice: Decimal.Value;
  sizeUsd: Decimal.Value;
  shares?: Decimal.Value | null;
  feesUsd?: Decimal.Value | null;
}): Decimal {
  if (input.status === "OPEN") return ZERO;
  const fees = D(input.feesUsd ?? 0);
  if (input.status === "VOID") return fees.negated();
  const size = D(input.sizeUsd);
  if (input.status === "LOST") return size.negated().minus(fees);
  const entry = D(input.entryPrice);
  const shares = input.shares != null && D(input.shares).gt(0) ? D(input.shares) : entry.gt(0) ? size.div(entry) : ZERO;
  return shares.minus(size).minus(fees);
}

type Bucket = { pnl: Decimal; count: number; wins: number; losses: number; turnover: Decimal };

function emptyBucket(): Bucket {
  return { pnl: new Decimal(0), count: 0, wins: 0, losses: 0, turnover: new Decimal(0) };
}

function add(bucket: Bucket, trade: PolyTradeLike) {
  const pnl = D(trade.pnlUsd);
  bucket.pnl = bucket.pnl.plus(pnl);
  bucket.count += 1;
  bucket.turnover = bucket.turnover.plus(D(trade.sizeUsd));
  if (trade.status === "WON") bucket.wins += 1;
  if (trade.status === "LOST") bucket.losses += 1;
}

function winRate(wins: number, losses: number) {
  return wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0;
}

function roi(pnl: Decimal, turnover: Decimal) {
  return turnover.gt(0) ? pnl.div(turnover).times(100).toDecimalPlaces(2).toString() : "0";
}

function row(name: string, b: Bucket) {
  return {
    name,
    pnl: b.pnl.toString(),
    count: b.count,
    wins: b.wins,
    losses: b.losses,
    winRate: winRate(b.wins, b.losses),
    turnover: b.turnover.toString(),
    roi: roi(b.pnl, b.turnover)
  };
}

function rows(map: Map<string, Bucket>) {
  return Array.from(map.entries())
    .map(([name, bucket]) => row(name, bucket))
    .sort((a, b) => D(b.pnl).comparedTo(D(a.pnl)));
}

export const PRICE_BUCKETS: Array<{ name: string; from: number; to: number }> = [
  { name: "0–20¢", from: 0, to: 0.2 },
  { name: "20–40¢", from: 0.2, to: 0.4 },
  { name: "40–50¢", from: 0.4, to: 0.5 },
  { name: "50–60¢", from: 0.5, to: 0.6 },
  { name: "60–80¢", from: 0.6, to: 0.8 },
  { name: "80–100¢", from: 0.8, to: 1.0000001 }
];

export function priceBucketOf(price: Decimal.Value): string {
  const value = D(price).toNumber();
  return (PRICE_BUCKETS.find((bucket) => value >= bucket.from && value < bucket.to) ?? PRICE_BUCKETS[PRICE_BUCKETS.length - 1]).name;
}

/** The moment a trade's result counts: when it resolved, falling back to when it opened. */
export function resultDate(trade: Pick<PolyTradeLike, "openedAt" | "resolvedAt">): Date {
  return trade.resolvedAt ?? trade.openedAt;
}

/** Monday of the Kyiv calendar week containing the given YYYY-MM-DD day. */
export function weekStartKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

export function kyivMonthStartKey(now: Date = new Date()): string {
  return `${kyivToday(now).slice(0, 7)}-01`;
}

/** Slippage of copied entries: what was paid versus the price of the signal that was copied. */
export function summarizeSlippage(trades: PolyTradeLike[]) {
  let count = 0;
  let sumPoints = new Decimal(0);
  let sumPct = new Decimal(0);
  let costUsd = new Decimal(0);
  let worse = 0;
  for (const trade of trades) {
    if (trade.section !== "COPYTRADE" || trade.signalPrice == null) continue;
    const signal = D(trade.signalPrice);
    const entry = D(trade.entryPrice);
    if (signal.lte(0) || entry.lte(0)) continue;
    const diff = entry.minus(signal);
    const shares = trade.shares != null && D(trade.shares).gt(0) ? D(trade.shares) : D(trade.sizeUsd).div(entry);
    count += 1;
    sumPoints = sumPoints.plus(diff);
    sumPct = sumPct.plus(diff.div(signal).times(100));
    costUsd = costUsd.plus(diff.times(shares));
    if (diff.gt(0)) worse += 1;
  }
  return {
    count,
    // Positive means the copy paid more than the leader, i.e. it cost money.
    avgPoints: count ? sumPoints.div(count).toDecimalPlaces(4).toString() : "0",
    avgPercent: count ? sumPct.div(count).toDecimalPlaces(2).toString() : "0",
    costUsd: costUsd.toDecimalPlaces(4).toString(),
    worseCount: worse
  };
}

export type PolyFilter = { section?: PolySectionKey; agentName?: string; marketKind?: PolyMarketKindKey };

export function summarizePoly(allTrades: PolyTradeLike[], now: Date = new Date()) {
  const monthStart = kyivMonthStartKey(now);
  const today = kyivToday(now);
  const trades = allTrades;
  const resolved = trades.filter((trade) => trade.status !== "OPEN");
  const open = trades.filter((trade) => trade.status === "OPEN");

  const total = emptyBucket();
  const month = emptyBucket();
  const todayBucket = emptyBucket();
  const bySection = new Map<string, Bucket>();
  const byAgent = new Map<string, Bucket>();
  const byKind = new Map<string, Bucket>();
  const byPrice = new Map<string, Bucket>(PRICE_BUCKETS.map((bucket) => [bucket.name, emptyBucket()]));
  const byHour = new Map<string, Bucket>(Array.from({ length: 24 }, (_, hour) => [String(hour).padStart(2, "0"), emptyBucket()]));
  const byDay = new Map<string, Bucket>();
  const byWeek = new Map<string, Bucket>();
  let grossProfit = new Decimal(0);
  let grossLoss = new Decimal(0);
  let fees = new Decimal(0);
  let best: PolyTradeLike | null = null;
  let worst: PolyTradeLike | null = null;

  const slot = (map: Map<string, Bucket>, key: string) => {
    if (!map.has(key)) map.set(key, emptyBucket());
    return map.get(key) as Bucket;
  };

  for (const trade of resolved) {
    const pnl = D(trade.pnlUsd);
    const when = resultDate(trade);
    const day = kyivStamp(when).slice(0, 10);
    add(total, trade);
    if (day >= monthStart) add(month, trade);
    if (day === today) add(todayBucket, trade);
    add(slot(bySection, trade.section), trade);
    if (trade.section === "AI_AGENT") add(slot(byAgent, trade.agentName?.trim() || "Без назви"), trade);
    add(slot(byKind, trade.marketKind), trade);
    add(slot(byPrice, priceBucketOf(trade.entryPrice)), trade);
    add(slot(byHour, String(trade.openedAt.getUTCHours()).padStart(2, "0")), trade);
    add(slot(byDay, day), trade);
    add(slot(byWeek, weekStartKey(day)), trade);
    if (pnl.gt(0)) grossProfit = grossProfit.plus(pnl);
    if (pnl.lt(0)) grossLoss = grossLoss.plus(pnl.abs());
    fees = fees.plus(D(trade.feesUsd ?? 0));
    if (!best || pnl.gt(D(best.pnlUsd))) best = trade;
    if (!worst || pnl.lt(D(worst.pnlUsd))) worst = trade;
  }

  let running = new Decimal(0);
  const timeline = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => {
      running = running.plus(bucket.pnl);
      return { date, label: `${date.slice(8, 10)}.${date.slice(5, 7)}`, pnl: bucket.pnl.toNumber(), net: running.toNumber(), count: bucket.count };
    });

  const wins = resolved.filter((trade) => D(trade.pnlUsd).gt(0));
  const losses = resolved.filter((trade) => D(trade.pnlUsd).lt(0));
  const openExposure = open.reduce((sum, trade) => sum.plus(D(trade.sizeUsd)), new Decimal(0));
  const brief = (trade: PolyTradeLike | null) =>
    trade ? { id: trade.id, title: trade.title, pnl: D(trade.pnlUsd).toString(), resolvedAt: resultDate(trade).toISOString() } : null;

  return {
    totalPnl: total.pnl.toString(),
    monthPnl: month.pnl.toString(),
    todayPnl: todayBucket.pnl.toString(),
    count: total.count,
    monthCount: month.count,
    openCount: open.length,
    openExposure: openExposure.toString(),
    wins: total.wins,
    losses: total.losses,
    voids: resolved.filter((trade) => trade.status === "VOID").length,
    winRate: winRate(total.wins, total.losses),
    turnover: total.turnover.toString(),
    roi: roi(total.pnl, total.turnover),
    grossProfit: grossProfit.toString(),
    grossLoss: grossLoss.toString(),
    profitFactor: grossLoss.gt(0) ? grossProfit.div(grossLoss).toDecimalPlaces(2).toString() : null,
    avgWin: wins.length ? grossProfit.div(wins.length).toDecimalPlaces(4).toString() : "0",
    avgLoss: losses.length ? grossLoss.div(losses.length).toDecimalPlaces(4).toString() : "0",
    fees: fees.toString(),
    best: brief(best),
    worst: brief(worst),
    bySection: rows(bySection),
    byAgent: rows(byAgent),
    byMarketKind: rows(byKind),
    byPriceBucket: PRICE_BUCKETS.map((bucket) => row(bucket.name, byPrice.get(bucket.name) as Bucket)),
    byHourUtc: Array.from(byHour.entries()).map(([hour, bucket]) => row(hour, bucket)),
    byDay: Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30).map(([name, bucket]) => row(name, bucket)),
    byWeek: Array.from(byWeek.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([name, bucket]) => row(name, bucket)),
    timeline,
    slippage: summarizeSlippage(trades)
  };
}

/**
 * Pool reconciliation. `ledgerBalance` is the pool rebuilt from its ledger rows, `postedTradePnl` is the
 * PnL actually posted for trades, `tradesPnl` is what the trade rows say should have been posted.
 * Any non-zero drift means a trade or a balance was changed behind the ledger's back.
 */
export function reconcilePool(input: {
  storedBalance: Decimal.Value;
  ledgerBalance: Decimal.Value;
  postedTradePnl: Decimal.Value;
  tradesPnl: Decimal.Value;
  lockedPrincipal: Decimal.Value;
}) {
  const balanceDrift = D(input.storedBalance).minus(D(input.ledgerBalance));
  const pnlDrift = D(input.postedTradePnl).minus(D(input.tradesPnl));
  return {
    storedBalance: D(input.storedBalance).toString(),
    ledgerBalance: D(input.ledgerBalance).toString(),
    balanceDrift: balanceDrift.toString(),
    postedTradePnl: D(input.postedTradePnl).toString(),
    tradesPnl: D(input.tradesPnl).toString(),
    pnlDrift: pnlDrift.toString(),
    lockedPrincipal: D(input.lockedPrincipal).toString(),
    ok: balanceDrift.isZero() && pnlDrift.isZero()
  };
}
