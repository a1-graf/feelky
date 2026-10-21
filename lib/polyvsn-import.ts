import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D, roundCurrency } from "@/lib/money";
import { lockPolyFunds, movePolyFunds, postPolyAdjustment, upsertPolyTrades } from "@/lib/poly";
import type { PolyTradeInput } from "@/lib/poly";
import { inferMarketKind } from "@/lib/poly-stats";
import rawTrades from "@/scripts/data/polyvsn-trades.json";

/**
 * One-off import of the Polyvsn history (read-only snapshot of 2026-10-20 ~23:30 UTC) into the Polymarket pool.
 * Every record has a stable id, so running it again changes nothing.
 */

export const POLYVSN_AI_AGENT = "AI Quantum Predator";
/** Real cash the owner confirmed on Wallet 1. The "46.34 in trades" on Wallet 2 is not real and is not imported. */
export const POLYVSN_CASH_NOW = "52.63";
export const POLYVSN_MAIN_WALLET_NOTE = "джерело: головний (main) гаманець Графа";

type RawTrade = (typeof rawTrades)[number];

export type PolyvsnFlow =
  | { kind: "deposit" | "withdraw"; importId: string; amount: string; date: Date; note: string }
  | { kind: "lock"; importId: string; amount: string; date: Date; note: string; agentName: string; lockDays: number }
  | { kind: "adjustment"; importId: string; amount: string; date: Date; note: string };

export type PolyvsnPlan = { trades: PolyTradeInput[]; flows: PolyvsnFlow[] };

const at = (iso: string) => new Date(iso);

/** Deposits and withdrawals are reconstructed from the balance curve and on-chain data; internal W1<->W2 transfers and the 50.09 in/out cycle net to zero and are skipped. */
const BASE_FLOWS: PolyvsnFlow[] = [
  { kind: "deposit", importId: "polyvsn:flow:deposit:249.10", amount: "249.10", date: at("2026-10-11T13:09:25Z"), note: `Polyvsn: перший депозит (виведено з леджера, час = перший запис балансу); ${POLYVSN_MAIN_WALLET_NOTE}` },
  { kind: "deposit", importId: "polyvsn:flow:deposit:1.67", amount: "1.67", date: at("2026-10-11T13:12:33Z"), note: `Polyvsn: надходження 1.67 невідомого походження (бонус/повернення?); ${POLYVSN_MAIN_WALLET_NOTE}` },
  {
    kind: "lock",
    importId: "polyvsn:flow:lock:quantum-predator",
    amount: "250.77",
    date: at("2026-10-11T13:13:46Z"),
    note: "Polyvsn: вклад у AI Quantum Predator (підтверджено API pool/history), 30 днів",
    agentName: POLYVSN_AI_AGENT,
    lockDays: 30
  },
  { kind: "deposit", importId: "polyvsn:flow:deposit:10.87", amount: "10.87", date: at("2026-10-11T19:02:33Z"), note: `Polyvsn: депозит (виведено з леджера); ${POLYVSN_MAIN_WALLET_NOTE}` },
  { kind: "deposit", importId: "polyvsn:flow:deposit:79.58", amount: "79.58", date: at("2026-10-13T20:37:24Z"), note: `Polyvsn: депозит у Wallet 1 (виведено з леджера); ${POLYVSN_MAIN_WALLET_NOTE}` },
  {
    kind: "withdraw",
    importId: "polyvsn:flow:withdraw:9.19",
    amount: "9.19",
    date: at("2026-10-19T10:59:48Z"),
    note: "Polyvsn: вивід з Wallet 1 на 0x5eac1a50…8119 (ончейн підтверджено, призначення — ймовірний вивід)"
  }
];

/** Six settlements in the cash ledger (14.10 07:53-09:11 UTC) have no row in the Polyvsn history, so their entry cost is unknown. */
export const UNATTRIBUTED_SETTLEMENTS_GROSS = "138.37";

function tradeFromRaw(row: RawTrade): PolyTradeInput {
  const pnl = D(row.pnl);
  const closeMs = at(row.at).getTime();
  const windowStart = /-(\d{10})$/.exec(row.slug)?.[1];
  const isOpenStamp = row.timeKind === "open";
  // The history only has the close time. The market window start is the closest known lower bound of the entry.
  const windowMs = windowStart ? Number(windowStart) * 1000 : null;
  const openedAt = isOpenStamp ? at(row.at) : windowMs != null && windowMs <= closeMs ? new Date(windowMs) : at(row.at);
  const resolvedAt = isOpenStamp ? at("2026-10-20T16:04:04Z") : at(row.at);
  const slug = row.slug || `polyvsn-${row.id.slice(0, 24)}`;
  const parts = [
    `Polyvsn · ${row.sourceDetail}`,
    `вихід ${row.exit} (${row.closeType})`,
    row.wallet ? row.wallet : "гаманець невідомий (API не дає)",
    isOpenStamp ? "час відкриття точний" : "час відкриття невідомий (початок вікна ринку / час закриття)"
  ];
  return {
    externalId: `polyvsn:${row.id}`,
    section: row.section as "MANUAL" | "COPYTRADE",
    agentName: null,
    walletRef: row.wallet,
    marketSlug: slug,
    title: row.title,
    marketKind: inferMarketKind(slug, row.title),
    outcome: row.side,
    entryPrice: row.entry,
    sizeUsd: row.size,
    shares: row.shares ? D(row.shares).toDecimalPlaces(8).toString() : null,
    feesUsd: row.fee,
    status: pnl.gt(0) ? "WON" : pnl.lt(0) ? "LOST" : "VOID",
    pnl: pnl.toString(),
    openedAt,
    resolvedAt,
    note: parts.join(" · ")
  };
}

/** Pure: builds every record to import, including the balancing adjustment for settlements with unknown cost. */
export function buildPolyvsnPlan(): PolyvsnPlan {
  const trades = rawTrades.map(tradeFromRaw);
  const flowNet = BASE_FLOWS.reduce((sum, flow) => (flow.kind === "deposit" ? sum.plus(flow.amount) : flow.kind === "withdraw" ? sum.minus(flow.amount) : sum.minus(flow.amount)), D(0));
  const tradesPnl = trades.reduce((sum, trade) => sum.plus(trade.pnl ?? 0), D(0));
  const adjustment = D(POLYVSN_CASH_NOW).minus(flowNet).minus(tradesPnl);
  const flows: PolyvsnFlow[] = [...BASE_FLOWS];
  if (!adjustment.isZero()) {
    flows.push({
      kind: "adjustment",
      importId: "polyvsn:flow:unattributed-settlements",
      amount: roundCurrency(adjustment, "USDT").toString(),
      date: at("2026-10-14T09:11:25Z"),
      note: `Polyvsn: 6 розрахунків без рядка в історії (валова виручка ${UNATTRIBUTED_SETTLEMENTS_GROSS}, вартість входу невідома); сума = різниця до підтвердженого кеша ${POLYVSN_CASH_NOW}`
    });
  }
  return { trades, flows: flows.sort((a, b) => a.date.getTime() - b.date.getTime()) };
}

export type PolyvsnPlanTotals = {
  pool: string;
  locked: string;
  netContributed: string;
  tradesPnl: string;
  unattributed: string;
  totalPnl: string;
};

/** Pure: what the pool will show once the plan is applied (the same arithmetic the ledger does). */
export function summarizePolyvsnPlan(plan: PolyvsnPlan): PolyvsnPlanTotals {
  let pool = D(0);
  let locked = D(0);
  let netContributed = D(0);
  let unattributed = D(0);
  for (const flow of plan.flows) {
    const amount = D(flow.amount);
    if (flow.kind === "deposit") {
      pool = pool.plus(amount);
      netContributed = netContributed.plus(amount);
    } else if (flow.kind === "withdraw") {
      pool = pool.minus(amount);
      netContributed = netContributed.minus(amount);
    } else if (flow.kind === "lock") {
      pool = pool.minus(amount);
      locked = locked.plus(amount);
    } else {
      pool = pool.plus(amount);
      unattributed = unattributed.plus(amount);
    }
  }
  const tradesPnl = plan.trades.filter((trade) => trade.section !== "AI_AGENT").reduce((sum, trade) => sum.plus(trade.pnl ?? 0), D(0));
  pool = pool.plus(tradesPnl);
  const fmt = (value: Decimal) => roundCurrency(value, "USDT").toString();
  return {
    pool: fmt(pool),
    locked: fmt(locked),
    netContributed: fmt(netContributed),
    tradesPnl: fmt(tradesPnl),
    unattributed: fmt(unattributed),
    totalPnl: fmt(pool.plus(locked).minus(netContributed))
  };
}

export type PolyvsnImportResult = {
  trades: { created: number; updated: number; duplicate: number; failed: number };
  flows: Array<{ importId: string; status: "applied" | "skipped" }>;
};

/** Applies the plan through the normal Polymarket services. Safe to repeat: existing records are skipped or compared. */
export async function runPolyvsnImport(
  userId: string,
  options: { accountName: string; allowOverdraft?: boolean; plan?: PolyvsnPlan }
): Promise<PolyvsnImportResult> {
  const plan = options.plan ?? buildPolyvsnPlan();
  const flows: PolyvsnImportResult["flows"] = [];
  for (const flow of plan.flows) {
    const exists =
      flow.kind === "lock"
        ? await prisma.polyLock.findFirst({ where: { userId, agentName: flow.agentName, lockedAt: flow.date } })
        : await prisma.transaction.findFirst({ where: { userId, metadata: { path: ["importId"], equals: flow.importId } } });
    if (exists) {
      flows.push({ importId: flow.importId, status: "skipped" });
      continue;
    }
    if (flow.kind === "lock") {
      await lockPolyFunds(userId, { amount: flow.amount, agentName: flow.agentName, lockDays: flow.lockDays, lockedAt: flow.date, note: flow.note });
    } else if (flow.kind === "adjustment") {
      await postPolyAdjustment(userId, { amount: flow.amount, note: flow.note, date: flow.date, importId: flow.importId });
    } else {
      await movePolyFunds(userId, {
        direction: flow.kind,
        amount: flow.amount,
        accountName: options.accountName,
        date: flow.date,
        note: flow.note,
        allowOverdraft: options.allowOverdraft,
        importId: flow.importId
      });
    }
    flows.push({ importId: flow.importId, status: "applied" });
  }
  const batch = await upsertPolyTrades(userId, plan.trades.map((input) => ({ ok: true as const, input })));
  return { trades: { created: batch.created, updated: batch.updated, duplicate: batch.duplicate, failed: batch.failed }, flows };
}
