import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import { getPolyOverview, POLY_FLOW_SOURCE, POLY_UNATTRIBUTED_SOURCE } from "@/lib/poly";
import { resultDate } from "@/lib/poly-stats";
import { kyivStamp } from "@/lib/agent-query";

/** Data for the five trial layouts of the Polymarket page (/poly/v1…v5). Everything here is read from the database. */

type Overview = Awaited<ReturnType<typeof getPolyOverview>>;
export type PolyTradeView = Overview["trades"][number];

/** Public Polymarket profiles behind the wallet refs (same mapping the Polyvsn import used). */
export const POLY_WALLET_ADDRESSES: Record<string, string> = {
  "@11121f": "0xe861e58952bf74430b3cdbe6cce3e857631ce3d5",
  "@55011": "0x8f037db9cc0b5babd15297cb2e32b8b56340dfd7"
};

/** Where a trade came from, read from the note the importer or the bot wrote. Falls back to the section. */
export function polyTradeSource(trade: Pick<PolyTradeView, "section" | "agentName" | "note">): string {
  const note = (trade.note ?? "").toLowerCase();
  if (trade.section === "AI_AGENT") return trade.agentName?.trim() || "AI-агент";
  // Checked first: these notes also say "not poly-flipper bot".
  if (note.includes("polyvsn built-in copy")) return "Копіювання в Polyvsn";
  if (note.includes("poly-flipper")) return "Бот poly-flipper";
  if (note.includes("ручна") || trade.section === "MANUAL") return "Вручну";
  return "Копітрейд";
}

export type EquityPoint = { t: number; total: number; delta: number; label: string };

/** Running result of closed trades in the order they resolved, plus drawdown from the running peak. */
export function polyEquity(trades: PolyTradeView[]) {
  const closed = trades
    .filter((trade) => trade.status !== "OPEN")
    .map((trade) => ({ trade, when: resultDate({ openedAt: new Date(trade.openedAt), resolvedAt: trade.resolvedAt ? new Date(trade.resolvedAt) : null }) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  let running = new Decimal(0);
  let peak = new Decimal(0);
  let maxDrawdown = new Decimal(0);
  let maxDrawdownAt: string | null = null;
  const points: EquityPoint[] = [];
  const underwater: Array<{ t: number; drawdown: number; label: string }> = [];
  for (const { trade, when } of closed) {
    running = running.plus(D(trade.pnlUsd));
    if (running.gt(peak)) peak = running;
    const drawdown = peak.minus(running);
    if (drawdown.gt(maxDrawdown)) {
      maxDrawdown = drawdown;
      maxDrawdownAt = when.toISOString();
    }
    points.push({ t: when.getTime(), total: running.toNumber(), delta: D(trade.pnlUsd).toNumber(), label: trade.title });
    underwater.push({ t: when.getTime(), drawdown: -drawdown.toNumber(), label: trade.title });
  }
  return {
    points,
    underwater,
    peak: peak.toString(),
    current: running.toString(),
    maxDrawdown: maxDrawdown.toString(),
    maxDrawdownAt,
    currentDrawdown: peak.minus(running).toString()
  };
}

/** Win and loss streaks over closed trades in resolution order (a void trade breaks nothing). */
export function polyStreaks(trades: PolyTradeView[]) {
  const ordered = trades
    .filter((trade) => trade.status === "WON" || trade.status === "LOST")
    .sort((a, b) => new Date(a.resolvedAt ?? a.openedAt).getTime() - new Date(b.resolvedAt ?? b.openedAt).getTime());
  let longestWin = 0;
  let longestLoss = 0;
  let worstRunUsd = new Decimal(0);
  let run = 0;
  let runUsd = new Decimal(0);
  let last: "WON" | "LOST" | null = null;
  for (const trade of ordered) {
    if (trade.status === last) {
      run += 1;
      runUsd = runUsd.plus(D(trade.pnlUsd));
    } else {
      run = 1;
      runUsd = D(trade.pnlUsd);
      last = trade.status as "WON" | "LOST";
    }
    if (last === "WON") longestWin = Math.max(longestWin, run);
    else {
      longestLoss = Math.max(longestLoss, run);
      if (runUsd.lt(worstRunUsd)) worstRunUsd = runUsd;
    }
  }
  return { longestWin, longestLoss, worstLossRunUsd: worstRunUsd.toString(), current: last ? { kind: last, length: run } : null };
}

export type PolyGroup = { name: string; count: number; wins: number; losses: number; pnl: string; turnover: string; winShare: string; yieldPct: string; avgStake: string };

/** Groups closed trades by any key: count, result, stake turnover, share of winning trades and return on stakes. */
export function polyGroupBy(trades: PolyTradeView[], key: (trade: PolyTradeView) => string): PolyGroup[] {
  const map = new Map<string, { count: number; wins: number; losses: number; pnl: Decimal; turnover: Decimal }>();
  for (const trade of trades) {
    if (trade.status === "OPEN") continue;
    const name = key(trade);
    const bucket = map.get(name) ?? { count: 0, wins: 0, losses: 0, pnl: new Decimal(0), turnover: new Decimal(0) };
    bucket.count += 1;
    if (trade.status === "WON") bucket.wins += 1;
    if (trade.status === "LOST") bucket.losses += 1;
    bucket.pnl = bucket.pnl.plus(D(trade.pnlUsd));
    bucket.turnover = bucket.turnover.plus(D(trade.sizeUsd));
    map.set(name, bucket);
  }
  return Array.from(map.entries())
    .map(([name, b]) => ({
      name,
      count: b.count,
      wins: b.wins,
      losses: b.losses,
      pnl: b.pnl.toString(),
      turnover: b.turnover.toString(),
      winShare: b.wins + b.losses ? new Decimal(b.wins).div(b.wins + b.losses).times(100).toString() : "0",
      yieldPct: b.turnover.gt(0) ? b.pnl.div(b.turnover).times(100).toString() : "0",
      avgStake: b.count ? b.turnover.div(b.count).toString() : "0"
    }))
    .sort((a, b) => D(b.pnl).comparedTo(D(a.pnl)));
}

/** Result per Kyiv calendar day, worst first. */
export function polyDays(trades: PolyTradeView[]) {
  return polyGroupBy(trades, (trade) => kyivStamp(new Date(trade.resolvedAt ?? trade.openedAt)).slice(0, 10)).sort((a, b) => D(a.pnl).comparedTo(D(b.pnl)));
}

export async function getPolyVariantsData(userId: string) {
  const overview = await getPolyOverview(userId);
  const poolId = `${userId}-polymarket`;
  const [flows, adjustments] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: TransactionType.TRANSFER, metadata: { path: ["source"], equals: POLY_FLOW_SOURCE } },
      select: { id: true, amount: true, transactionDate: true, note: true, sourceAccountId: true, destinationAccountId: true },
      orderBy: { transactionDate: "asc" }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, destinationAccountId: poolId, metadata: { path: ["source"], equals: POLY_UNATTRIBUTED_SOURCE } },
      select: { id: true, amount: true, transactionDate: true, note: true },
      orderBy: { transactionDate: "asc" }
    })
  ]);
  const deposits = flows.filter((row) => row.destinationAccountId === poolId);
  const withdrawals = flows.filter((row) => row.sourceAccountId === poolId);
  const sum = (rows: Array<{ amount: { toString(): string } }>) => rows.reduce((total, row) => total.plus(row.amount.toString()), new Decimal(0));
  const deposited = sum(deposits);
  const withdrawn = sum(withdrawals);
  const unattributed = sum(adjustments);
  const tradesPnl = overview.trades.filter((trade) => trade.section !== "AI_AGENT").reduce((total, trade) => total.plus(D(trade.pnlUsd)), new Decimal(0));
  const now = D(overview.pool.total);
  return {
    overview,
    money: {
      deposited: deposited.toString(),
      withdrawn: withdrawn.toString(),
      netIn: deposited.minus(withdrawn).toString(),
      tradesPnl: tradesPnl.toString(),
      unattributed: unattributed.toString(),
      free: overview.pool.balance,
      locked: overview.pool.lockedPrincipal,
      now: now.toString(),
      /** What is there now against what went in, net of withdrawals. */
      change: now.minus(deposited.minus(withdrawn)).toString(),
      changePct: deposited.minus(withdrawn).gt(0) ? now.minus(deposited.minus(withdrawn)).div(deposited.minus(withdrawn)).times(100).toString() : "0"
    },
    flows: [
      ...flows.map((row) => ({
        id: row.id,
        kind: row.destinationAccountId === poolId ? ("deposit" as const) : ("withdraw" as const),
        amount: row.amount.toString(),
        date: row.transactionDate.toISOString(),
        note: row.note
      })),
      ...adjustments.map((row) => ({ id: row.id, kind: "adjustment" as const, amount: row.amount.toString(), date: row.transactionDate.toISOString(), note: row.note }))
    ].sort((a, b) => a.date.localeCompare(b.date))
  };
}

export type PolyVariantsData = Awaited<ReturnType<typeof getPolyVariantsData>>;
