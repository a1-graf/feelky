import type Decimal from "decimal.js";
import { createFxTradeWithLedger, ensureFxBroker, moveFxBroker } from "@/lib/fx";
import type { FxFlowInput, FxTradeInput } from "@/lib/fx";
import { summarizeFx, summarizeFxFlows } from "@/lib/fx-stats";
import { D } from "@/lib/money";
import raw from "@/scripts/data/fx-trades.json";

/**
 * One-off import of the FxPro MT5 history (read-only snapshot of 2026-10-21 14:23 UTC): every closed position of the
 * account since the first Aurum trade, plus the deposit and the withdrawal. Ids are the MT5 position ticket and the
 * MT5 balance-operation ticket, so running it again changes nothing - and the evening agent pull, which sends the
 * same tickets, finds these trades already recorded.
 */

type RawTrade = (typeof raw.trades)[number];
type RawFlow = (typeof raw.flows)[number];

export type FxImportPlan = { trades: FxTradeInput[]; flows: Array<Omit<FxFlowInput, "importId"> & { importId: string }> };

const tradeFromRaw = (row: RawTrade): FxTradeInput => ({
  externalId: row.externalId,
  instrument: row.instrument,
  side: row.side as "BUY" | "SELL",
  lots: row.lots,
  openPrice: row.openPrice,
  closePrice: row.closePrice,
  stopLoss: row.stopLoss,
  riskAmount: row.riskAmount,
  openedAt: new Date(row.openedAt),
  closedAt: new Date(row.closedAt),
  pnl: row.pnl,
  commission: row.commission,
  swap: row.swap,
  setup: row.setup,
  note: row.note
});

const flowFromRaw = (row: RawFlow) => ({
  importId: row.importId,
  direction: row.kind as "deposit" | "withdraw",
  amount: row.amount,
  date: new Date(row.date),
  note: row.note
});

/** Pure: every record to import, oldest first. */
export function buildFxImportPlan(): FxImportPlan {
  return {
    trades: raw.trades.map(tradeFromRaw).sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime()),
    flows: raw.flows.map(flowFromRaw).sort((a, b) => a.date.getTime() - b.date.getTime())
  };
}

/** Pure: the broker balance and statistics the plan produces, with the same arithmetic the ledger uses. */
export function summarizeFxImportPlan(plan: FxImportPlan, now: Date = new Date()) {
  const flows = summarizeFxFlows(plan.flows.map((flow, index) => ({ id: String(index), direction: flow.direction, amount: flow.amount, date: flow.date as Date })));
  const stats = summarizeFx(plan.trades.map((trade, index) => ({ ...trade, id: String(index), pnl: trade.pnl as Decimal.Value })), now);
  return { balance: D(flows.net).plus(stats.totalPnl).toString(), deposited: flows.deposited, withdrawn: flows.withdrawn, stats };
}

export type FxImportResult = {
  trades: { created: number; duplicate: number };
  flows: { applied: number; skipped: number };
};

/** Applies the plan through the normal FX services. Safe to repeat. `counterpartyName` is the own account the deposit came from. */
export async function runFxImport(userId: string, options: { counterpartyName?: string | null; plan?: FxImportPlan } = {}): Promise<FxImportResult> {
  const plan = options.plan ?? buildFxImportPlan();
  const broker = await ensureFxBroker(userId);
  const result: FxImportResult = { trades: { created: 0, duplicate: 0 }, flows: { applied: 0, skipped: 0 } };
  for (const flow of plan.flows) {
    const { duplicate } = await moveFxBroker(userId, { ...flow, accountId: broker.id, counterpartyName: options.counterpartyName ?? null });
    if (duplicate) result.flows.skipped += 1;
    else result.flows.applied += 1;
  }
  for (const trade of plan.trades) {
    const { duplicate } = await createFxTradeWithLedger(userId, { ...trade, accountId: broker.id });
    if (duplicate) result.trades.duplicate += 1;
    else result.trades.created += 1;
  }
  return result;
}
