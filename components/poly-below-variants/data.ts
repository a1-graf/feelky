import type { getPolyOverview } from "@/lib/poly";
import { POLY_SECTION_LABELS } from "@/lib/poly-stats";
import type { PolySectionKey } from "@/lib/poly-stats";
import { AGENT_SLOTS, kindLabel } from "./labels";
import type { BreakdownKey } from "./labels";

type Overview = Awaited<ReturnType<typeof getPolyOverview>>;
type StatsRow = Overview["all"]["byMarketKind"][number];

export type BelowRow = {
  name: string;
  label: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  roi: string;
  pnl: string;
};

export type BelowTrade = {
  id: string;
  externalId: string;
  section: PolySectionKey;
  agentName: string | null;
  marketKind: string;
  title: string;
  outcome: string;
  entryPrice: string;
  sizeUsd: string;
  feesUsd: string;
  status: "OPEN" | "WON" | "LOST" | "VOID";
  pnlUsd: string;
  openedAt: string;
  resolvedAt: string | null;
  signalPrice: string | null;
  liveNote: string | null;
};

export type BelowSource = {
  key: PolySectionKey;
  label: string;
  all: BelowRow;
  period: {
    count: number;
    openCount: number;
    pnl: string;
    winRate: number;
    roi: string;
  };
};

export type BelowAgent = {
  name: string;
  pnl: string;
  count: number;
  winRate: number;
  lock: {
    amount: string;
    lockedAt: string;
    unlockAt: string;
    daysLeft: number;
    canRelease: boolean;
  } | null;
  releasedCount: number;
  realized: string;
};

export type BelowData = {
  hidden: boolean;
  periodLabel: string;
  metrics: {
    totalPnl: string;
    count: number;
    wins: number;
    losses: number;
    voids: number;
    winRate: number;
    roi: string;
    turnover: string;
    openExposure: string;
    openCount: number;
    profitFactor: string | null;
    grossProfit: string;
    grossLoss: string;
    avgWin: string;
    avgLoss: string;
    fees: string;
    poolTotal: string;
    poolBalance: string;
    lockedPrincipal: string;
  };
  reconcile: { ok: boolean; balanceDrift: string; pnlDrift: string } | null;
  sources: BelowSource[];
  agents: BelowAgent[];
  emptyAgentSlots: number;
  breakdowns: Record<BreakdownKey, BelowRow[]>;
  slippage: Overview["all"]["slippage"];
  trades: BelowTrade[];
};

// summarizePoly rounds the win rate to whole percent; the page shows two decimals, so it is recomputed.
const exactWinRate = (wins: number, losses: number) =>
  wins + losses ? (wins / (wins + losses)) * 100 : 0;
const dm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
const weekLabel = (monday: string) => {
  const end = new Date(`${monday}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${dm(monday)}–${dm(end.toISOString().slice(0, 10))}`;
};

function toRow(row: StatsRow, label = row.name): BelowRow {
  return {
    name: row.name,
    label,
    count: row.count,
    wins: row.wins,
    losses: row.losses,
    winRate: exactWinRate(row.wins, row.losses),
    roi: row.roi,
    pnl: row.pnl,
  };
}

const emptyRow = (name: string, label: string): BelowRow => ({
  name,
  label,
  count: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  roi: "0",
  pnl: "0",
});

/** Plain, serialisable slice of the Poly overview that every lower-section variant renders. */
export function toBelowData(overview: Overview): BelowData {
  const { all, sections, pool, locks, hidden, reconcile, period } = overview;
  const activeLocks = locks.filter((lock) => lock.status === "LOCKED");
  const agentName = (name: string | null) => name ?? "Без назви";
  const agentNames = Array.from(
    new Set([
      ...all.byAgent.map((row) => row.name),
      ...locks.map((lock) => agentName(lock.agentName)),
    ]),
  );
  const agents = agentNames.map((name): BelowAgent => {
    const stats = all.byAgent.find((row) => row.name === name);
    const lock = activeLocks
      .filter((item) => agentName(item.agentName) === name)
      .sort((a, b) => a.unlockAt.localeCompare(b.unlockAt))[0];
    const released = locks.filter(
      (item) => agentName(item.agentName) === name && item.resultPnlUsd != null,
    );
    return {
      name,
      pnl: stats?.pnl ?? "0",
      count: stats?.count ?? 0,
      winRate: stats ? exactWinRate(stats.wins, stats.losses) : 0,
      lock: lock
        ? {
            amount: lock.amountUsd,
            lockedAt: lock.lockedAt,
            unlockAt: lock.unlockAt,
            daysLeft: lock.daysLeft,
            canRelease: lock.canRelease,
          }
        : null,
      releasedCount: released.length,
      realized: String(
        released.reduce((sum, item) => sum + Number(item.resultPnlUsd), 0),
      ),
    };
  });

  const sourceKeys: PolySectionKey[] = ["MANUAL", "COPYTRADE", "AI_AGENT"];
  return {
    hidden,
    periodLabel: period.label,
    metrics: {
      totalPnl: all.totalPnl,
      count: all.count,
      wins: all.wins,
      losses: all.losses,
      voids: all.voids,
      winRate: exactWinRate(all.wins, all.losses),
      roi: all.roi,
      turnover: all.turnover,
      openExposure: all.openExposure,
      openCount: all.openCount,
      profitFactor: all.profitFactor,
      grossProfit: all.grossProfit,
      grossLoss: all.grossLoss,
      avgWin: all.avgWin,
      avgLoss: all.avgLoss,
      fees: all.fees,
      poolTotal: pool.total,
      poolBalance: pool.balance,
      lockedPrincipal: pool.lockedPrincipal,
    },
    reconcile: reconcile
      ? {
          ok: reconcile.ok,
          balanceDrift: reconcile.balanceDrift,
          pnlDrift: reconcile.pnlDrift,
        }
      : null,
    sources: sourceKeys.map((key) => {
      const row = all.bySection.find((item) => item.name === key);
      const stats = sections[key];
      return {
        key,
        label: POLY_SECTION_LABELS[key],
        all: row
          ? toRow(row, POLY_SECTION_LABELS[key])
          : emptyRow(key, POLY_SECTION_LABELS[key]),
        period: {
          count: stats.count,
          openCount: stats.openCount,
          pnl: stats.totalPnl,
          winRate: exactWinRate(stats.wins, stats.losses),
          roi: stats.roi,
        },
      };
    }),
    agents,
    emptyAgentSlots: Math.max(0, AGENT_SLOTS - agents.length),
    breakdowns: {
      market: all.byMarketKind.map((row) => toRow(row, kindLabel(row.name))),
      price: all.byPriceBucket
        .filter((row) => row.count > 0)
        .map((row) => toRow(row)),
      hour: all.byHourUtc
        .filter((row) => row.count > 0)
        .map((row) => toRow(row, `${row.name}:00`)),
      week: all.byWeek.map((row) => toRow(row, weekLabel(row.name))),
      day: all.byDay.slice(0, 10).map((row) => toRow(row, dm(row.name))),
    },
    slippage: all.slippage,
    trades: overview.trades.map((trade) => ({
      id: trade.id,
      externalId: trade.externalId,
      section: trade.section,
      agentName: trade.agentName,
      marketKind: trade.marketKind,
      title: trade.title,
      outcome: trade.outcome,
      entryPrice: trade.entryPrice,
      sizeUsd: trade.sizeUsd,
      feesUsd: trade.feesUsd,
      status: trade.status,
      pnlUsd: trade.pnlUsd,
      openedAt: trade.openedAt,
      resolvedAt: trade.resolvedAt,
      signalPrice: trade.signalPrice,
      liveNote: trade.note?.split("wallet-sync:")[1]?.trim() ?? null,
    })),
  };
}
