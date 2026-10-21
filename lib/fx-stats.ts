import Decimal from "decimal.js";
import { kyivDayStart, kyivStamp } from "@/lib/agent-query";
import { getOneRUsd } from "@/lib/fx-config";
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
  openPrice?: Decimal.Value | null;
  closePrice?: Decimal.Value | null;
  /** Initial risk in the account currency; shown as risk in R and as the secondary "R of own risk". */
  riskAmount?: Decimal.Value | null;
  setup?: string | null;
  note?: string | null;
  openedAt?: Date | null;
  closedAt: Date;
};

/** R of one trade on the fixed scale: net pnl over the size of 1R (default 5.10 USD), whatever the trade's own risk was. */
export function rOf(trade: Pick<FxTradeLike, "pnl">, oneR: Decimal.Value = getOneRUsd()): Decimal | null {
  const unit = D(oneR);
  return unit.gt(0) ? D(trade.pnl).div(unit) : null;
}

export function tradeR(pnl: Decimal.Value, oneR: Decimal.Value = getOneRUsd()): string | null {
  return rOf({ pnl }, oneR)?.toDecimalPlaces(2).toString() ?? null;
}

/** Initial risk of the trade expressed in R (risk 15 USD at 1R = 5.10 USD is 2.94R); null when the risk is unknown. */
export function riskInR(riskAmount: Decimal.Value | null | undefined, oneR: Decimal.Value = getOneRUsd()): string | null {
  if (riskAmount == null) return null;
  const unit = D(oneR);
  const risk = D(riskAmount);
  return unit.gt(0) && risk.gt(0) ? risk.div(unit).toDecimalPlaces(2).toString() : null;
}

/** Old metric: net pnl over the trade's own initial risk; null when the risk is unknown. */
export function ownRiskR(pnl: Decimal.Value, riskAmount: Decimal.Value | null | undefined): string | null {
  if (riskAmount == null) return null;
  const risk = D(riskAmount);
  return risk.gt(0) ? D(pnl).div(risk).toDecimalPlaces(2).toString() : null;
}

type Extreme = { instrument: string; pnl: string; r: string | null; closedAt: string };

export type FxPeriod = {
  /** `YYYY-MM` in Kyiv time, or `all`. */
  key: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: string;
  /** Sum of R (pnl / fixed 1R) over all trades; agrees with the money result. */
  sumR: string;
  avgR: string;
  /** Secondary: sum of R measured against each trade's own risk, over the `ownRCount` trades whose risk is known. */
  sumOwnR: string;
  ownRCount: number;
  best: Extreme | null;
  worst: Extreme | null;
};

function extreme(trade: FxTradeLike, oneR: Decimal.Value): Extreme {
  return { instrument: trade.instrument, pnl: D(trade.pnl).toString(), r: tradeR(trade.pnl, oneR), closedAt: trade.closedAt.toISOString() };
}

function periodOf(key: string, trades: FxTradeLike[], oneR: Decimal.Value): FxPeriod {
  let pnl = new Decimal(0);
  let sumR = new Decimal(0);
  let sumOwnR = new Decimal(0);
  let ownRCount = 0;
  let wins = 0;
  let losses = 0;
  let best: FxTradeLike | null = null;
  let worst: FxTradeLike | null = null;
  for (const trade of trades) {
    const value = D(trade.pnl);
    pnl = pnl.plus(value);
    if (value.gt(0)) wins += 1;
    if (value.lt(0)) losses += 1;
    const r = rOf(trade, oneR);
    if (r) sumR = sumR.plus(r);
    const own = ownRiskR(trade.pnl, trade.riskAmount);
    if (own != null) {
      sumOwnR = sumOwnR.plus(own);
      ownRCount += 1;
    }
    if (!best || value.gt(D(best.pnl))) best = trade;
    if (!worst || value.lt(D(worst.pnl))) worst = trade;
  }
  return {
    key,
    count: trades.length,
    wins,
    losses,
    winRate: winRate(wins, losses),
    pnl: pnl.toString(),
    sumR: sumR.toDecimalPlaces(2).toString(),
    avgR: trades.length ? sumR.div(trades.length).toDecimalPlaces(2).toString() : "0",
    sumOwnR: sumOwnR.toDecimalPlaces(2).toString(),
    ownRCount,
    best: best ? extreme(best, oneR) : null,
    worst: worst ? extreme(worst, oneR) : null
  };
}

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

export function summarizeFx(trades: FxTradeLike[], now: Date = new Date(), oneR: Decimal.Value = getOneRUsd()) {
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

  const monthGroups = new Map<string, FxTradeLike[]>();
  for (const trade of trades) {
    const key = kyivStamp(trade.closedAt).slice(0, 7);
    monthGroups.set(key, [...(monthGroups.get(key) ?? []), trade]);
  }
  const byMonth = Array.from(monthGroups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => periodOf(key, group, oneR));
  const allTime = periodOf("all", trades, oneR);
  const monthSumR = periodOf("month", trades.filter((trade) => trade.closedAt >= monthStart), oneR).sumR;

  const wins = trades.filter((trade) => D(trade.pnl).gt(0));
  const losses = trades.filter((trade) => D(trade.pnl).lt(0));
  const sortedRecent = [...trades].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());

  return {
    oneRUsd: D(oneR).toString(),
    totalPnl: total.pnl.toString(),
    monthPnl: month.pnl.toString(),
    count: total.count,
    monthCount: month.count,
    monthSumR,
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
    byMonth,
    allTime,
    trades: sortedRecent.map((trade) => ({
      id: trade.id,
      instrument: trade.instrument,
      side: trade.side,
      lots: trade.lots == null ? null : D(trade.lots).toString(),
      openPrice: trade.openPrice == null ? null : D(trade.openPrice).toString(),
      closePrice: trade.closePrice == null ? null : D(trade.closePrice).toString(),
      openedAt: trade.openedAt ? trade.openedAt.toISOString() : null,
      closedAt: trade.closedAt.toISOString(),
      pnl: D(trade.pnl).toString(),
      riskAmount: trade.riskAmount == null ? null : D(trade.riskAmount).toString(),
      r: tradeR(trade.pnl, oneR),
      riskR: riskInR(trade.riskAmount, oneR),
      ownR: ownRiskR(trade.pnl, trade.riskAmount),
      setup: trade.setup ?? null,
      note: trade.note ?? null
    })),
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

export type FxFlowLike = { id: string; direction: "deposit" | "withdraw"; amount: Decimal.Value; date: Date; note?: string | null };

/** Deposits and withdrawals of the broker account: what went in, what came out, what is still working. */
export function summarizeFxFlows(flows: FxFlowLike[]) {
  let deposited = new Decimal(0);
  let withdrawn = new Decimal(0);
  for (const flow of flows) {
    if (flow.direction === "deposit") deposited = deposited.plus(D(flow.amount));
    else withdrawn = withdrawn.plus(D(flow.amount));
  }
  const sorted = [...flows].sort((a, b) => b.date.getTime() - a.date.getTime());
  return {
    deposited: deposited.toString(),
    withdrawn: withdrawn.toString(),
    net: deposited.minus(withdrawn).toString(),
    items: sorted.map((flow) => ({
      id: flow.id,
      direction: flow.direction,
      amount: D(flow.amount).toString(),
      date: flow.date.toISOString(),
      note: flow.note ?? null
    }))
  };
}
