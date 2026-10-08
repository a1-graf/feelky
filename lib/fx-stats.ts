import Decimal from "decimal.js";
import { kyivDayStart, kyivStamp } from "@/lib/agent-query";
import { D } from "@/lib/money";
import { kyivToday } from "@/lib/telegram/dates";

/** Pure FX statistics: no database, so every figure here is unit-testable. */

export type FxTradeLike = {
  id: string;
  instrument: string;
  side: "BUY" | "SELL";
  pnl: Decimal.Value;
  commission?: Decimal.Value | null;
  swap?: Decimal.Value | null;
  lots?: Decimal.Value | null;
  setup?: string | null;
  note?: string | null;
  closedAt: Date;
};

type Bucket = { pnl: Decimal; count: number; wins: number; losses: number };

function emptyBucket(): Bucket {
  return { pnl: new Decimal(0), count: 0, wins: 0, losses: 0 };
}

function add(bucket: Bucket, pnl: Decimal) {
  bucket.pnl = bucket.pnl.plus(pnl);
  bucket.count += 1;
  if (pnl.gt(0)) bucket.wins += 1;
  if (pnl.lt(0)) bucket.losses += 1;
}

function winRate(wins: number, losses: number) {
  return wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0;
}

function rows(map: Map<string, Bucket>) {
  return Array.from(map.entries())
    .map(([name, b]) => ({ name, pnl: b.pnl.toString(), count: b.count, wins: b.wins, losses: b.losses, winRate: winRate(b.wins, b.losses) }))
    .sort((a, b) => D(b.pnl).comparedTo(D(a.pnl)));
}

/** Start of the current Kyiv month, so "this month" matches the user's calendar, not the server's. */
export function kyivMonthStart(now: Date = new Date()): Date {
  return kyivDayStart(`${kyivToday(now).slice(0, 7)}-01`);
}

export function summarizeFx(trades: FxTradeLike[], now: Date = new Date()) {
  const monthStart = kyivMonthStart(now);
  const total = emptyBucket();
  const month = emptyBucket();
  const byInstrument = new Map<string, Bucket>();
  const bySetup = new Map<string, Bucket>();
  const byDay = new Map<string, { profit: Decimal; loss: Decimal }>();
  let grossProfit = new Decimal(0);
  let grossLoss = new Decimal(0);
  let commission = new Decimal(0);
  let swap = new Decimal(0);
  let best: FxTradeLike | null = null;
  let worst: FxTradeLike | null = null;

  for (const trade of trades) {
    const pnl = D(trade.pnl);
    add(total, pnl);
    if (trade.closedAt >= monthStart) add(month, pnl);

    const instrument = trade.instrument.trim().toUpperCase();
    if (!byInstrument.has(instrument)) byInstrument.set(instrument, emptyBucket());
    add(byInstrument.get(instrument) as Bucket, pnl);

    const setup = trade.setup?.trim() || "Без сетапу";
    if (!bySetup.has(setup)) bySetup.set(setup, emptyBucket());
    add(bySetup.get(setup) as Bucket, pnl);

    if (pnl.gt(0)) grossProfit = grossProfit.plus(pnl);
    if (pnl.lt(0)) grossLoss = grossLoss.plus(pnl.abs());
    commission = commission.plus(D(trade.commission ?? 0));
    swap = swap.plus(D(trade.swap ?? 0));
    if (!best || pnl.gt(D(best.pnl))) best = trade;
    if (!worst || pnl.lt(D(worst.pnl))) worst = trade;

    const day = kyivStamp(trade.closedAt).slice(0, 10);
    const point = byDay.get(day) || { profit: new Decimal(0), loss: new Decimal(0) };
    if (pnl.gt(0)) point.profit = point.profit.plus(pnl);
    if (pnl.lt(0)) point.loss = point.loss.plus(pnl.abs());
    byDay.set(day, point);
  }

  let running = new Decimal(0);
  const timeline = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, point]) => {
      running = running.plus(point.profit).minus(point.loss);
      return {
        date,
        label: `${date.slice(8, 10)}.${date.slice(5, 7)}`,
        profit: point.profit.toNumber(),
        loss: point.loss.toNumber(),
        net: running.toNumber()
      };
    });

  const wins = trades.filter((trade) => D(trade.pnl).gt(0));
  const losses = trades.filter((trade) => D(trade.pnl).lt(0));
  const sortedRecent = [...trades].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());

  return {
    totalPnl: total.pnl.toString(),
    monthPnl: month.pnl.toString(),
    count: total.count,
    monthCount: month.count,
    wins: total.wins,
    losses: total.losses,
    winRate: winRate(total.wins, total.losses),
    grossProfit: grossProfit.toString(),
    grossLoss: grossLoss.toString(),
    // Gross profit per unit of gross loss; null when there has been no loss to divide by.
    profitFactor: grossLoss.gt(0) ? grossProfit.div(grossLoss).toDecimalPlaces(2).toString() : null,
    avgWin: wins.length ? grossProfit.div(wins.length).toDecimalPlaces(2).toString() : "0",
    avgLoss: losses.length ? grossLoss.div(losses.length).toDecimalPlaces(2).toString() : "0",
    commission: commission.toString(),
    swap: swap.toString(),
    best: best ? { instrument: best.instrument, pnl: D(best.pnl).toString(), closedAt: best.closedAt.toISOString() } : null,
    worst: worst ? { instrument: worst.instrument, pnl: D(worst.pnl).toString(), closedAt: worst.closedAt.toISOString() } : null,
    byInstrument: rows(byInstrument),
    bySetup: rows(bySetup),
    timeline,
    recent: sortedRecent.slice(0, 12).map((trade) => ({
      id: trade.id,
      instrument: trade.instrument,
      side: trade.side,
      lots: trade.lots == null ? null : D(trade.lots).toString(),
      pnl: D(trade.pnl).toString(),
      setup: trade.setup ?? null,
      note: trade.note ?? null,
      closedAt: trade.closedAt.toISOString()
    }))
  };
}
