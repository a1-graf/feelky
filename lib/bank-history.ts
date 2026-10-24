import Decimal from "decimal.js";
import { AccountType } from "@prisma/client";
import { accountEffect } from "@/lib/ledger";
import { D } from "@/lib/money";
import type { RangePoint } from "@/components/range-area-chart";

/** The bank in USDT at one moment: the whole bank, what can be spent, and what works in Steam / Aurum / Polymarket. */
export type BankPoint = { t: number; total: number; available: number; turnover: number };

type HistAccount = { id: string; type: AccountType | string; currency: string; isReserved: boolean };
type HistTransaction = Parameters<typeof accountEffect>[0] & { transactionDate: Date };

export type BankHistoryInput = {
  now: Date;
  rate: Decimal.Value;
  /** The bank as the dashboard shows it now; the history is rebuilt backwards from these. */
  current: { total: Decimal.Value; available: Decimal.Value; turnover: Decimal.Value };
  polyPoolId: string;
  accounts: HistAccount[];
  transactions: HistTransaction[];
  expected: { amountUsdt: Decimal.Value; createdAt: Date; endedAt: Date | null }[];
  frozen: { amountUsdt: Decimal.Value; since: Date }[];
  polyLocks: { amountUsd: Decimal.Value; lockedAt: Date; releasedAt: Date | null; locked: boolean }[];
  steamInvestments: { sourceAccountId: string; externalAmount: Decimal.Value; startedAt: Date; endedAt: Date | null; active: boolean }[];
  steamRounds: { sourceAccountId: string; investedAmount: Decimal.Value; startedAt: Date; completedAt: Date | null; completed: boolean; destinationAccountId: string | null; finalAmountReceived: Decimal.Value | null; hasTransaction: boolean }[];
  steamWithdrawals: { destinationAccountId: string; amountReceived: Decimal.Value; withdrawalDate: Date }[];
};

const AVAILABLE_TYPES: string[] = [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET, AccountType.BANK_CARD, AccountType.CASH];
// Opening balances carry the epoch date: they are the starting point, not events.
const FIRST_REAL_DATE = Date.UTC(2000, 0, 1);

type Delta = { t: number; total: Decimal; available: Decimal; turnover: Decimal };

/**
 * Rebuilds the bank's past by undoing events from today's figures: every transaction's effect on each
 * account (the ledger's own math), Steam money going in and out, Polymarket principal in locks and
 * pending expected money. Nothing is invented: the last point always equals the live dashboard.
 */
export function buildBankHistory(input: BankHistoryInput): BankPoint[] {
  const rate = D(input.rate);
  const nowT = input.now.getTime();
  const accounts = new Map(input.accounts.map((account) => [account.id, account]));
  const toUsdt = (amount: Decimal.Value, currency: string) => (currency === "UAH" ? D(amount).div(rate) : D(amount));
  const zero = () => new Decimal(0);
  const deltas: Delta[] = [];
  const push = (date: Date, part: Partial<Omit<Delta, "t">>) => {
    const t = Math.min(date.getTime(), nowT);
    if (t < FIRST_REAL_DATE) return;
    deltas.push({ t, total: part.total ?? zero(), available: part.available ?? zero(), turnover: part.turnover ?? zero() });
  };
  const onAccount = (date: Date, accountId: string | null | undefined, delta: Decimal.Value) => {
    const account = accountId ? accounts.get(accountId) : undefined;
    if (!account || D(delta).isZero()) return;
    const value = toUsdt(delta, account.currency);
    if (account.isReserved) push(date, { total: value });
    else if (account.id === input.polyPoolId || account.type === AccountType.BROKER) push(date, { total: value, turnover: value });
    else if (AVAILABLE_TYPES.includes(account.type)) push(date, { total: value, available: value });
    else push(date, { total: value });
  };

  for (const transaction of input.transactions) {
    for (const accountId of new Set([transaction.sourceAccountId, transaction.destinationAccountId])) {
      if (accountId) onAccount(transaction.transactionDate, accountId, accountEffect(transaction, accountId));
    }
  }
  for (const item of input.expected) {
    push(item.createdAt, { total: D(item.amountUsdt) });
    if (item.endedAt) push(item.endedAt, { total: D(item.amountUsdt).negated() });
  }
  for (const item of input.frozen) push(item.since, { available: D(item.amountUsdt).negated() });
  for (const lock of input.polyLocks) {
    const amount = D(lock.amountUsd);
    push(lock.lockedAt, { total: amount, turnover: amount });
    if (!lock.locked && lock.releasedAt) push(lock.releasedAt, { total: amount.negated(), turnover: amount.negated() });
  }
  // Steam money leaves an account when it goes in; the real money then sits in Steam until it comes back.
  for (const item of input.steamInvestments) {
    const amount = D(item.externalAmount);
    onAccount(item.startedAt, item.sourceAccountId, amount.negated());
    push(item.startedAt, { total: amount, turnover: amount });
    if (!item.active && item.endedAt) push(item.endedAt, { total: amount.negated(), turnover: amount.negated() });
  }
  for (const round of input.steamRounds) {
    const amount = D(round.investedAmount);
    onAccount(round.startedAt, round.sourceAccountId, amount.negated());
    push(round.startedAt, { total: amount, turnover: amount });
    if (round.completed && round.completedAt) {
      push(round.completedAt, { total: amount.negated(), turnover: amount.negated() });
      if (!round.hasTransaction && round.finalAmountReceived != null) onAccount(round.completedAt, round.destinationAccountId, round.finalAmountReceived);
    }
  }
  for (const withdrawal of input.steamWithdrawals) onAccount(withdrawal.withdrawalDate, withdrawal.destinationAccountId, withdrawal.amountReceived);

  deltas.sort((a, b) => a.t - b.t);
  const sum = (key: "total" | "available" | "turnover") => deltas.reduce((result, delta) => result.plus(delta[key]), zero());
  let total = D(input.current.total).minus(sum("total"));
  let available = D(input.current.available).minus(sum("available"));
  let turnover = D(input.current.turnover).minus(sum("turnover"));
  const round = (value: Decimal) => Number(value.toFixed(2));
  const point = (t: number): BankPoint => ({ t, total: round(total), available: round(available), turnover: round(turnover) });

  const points: BankPoint[] = [];
  if (deltas.length) points.push(point(deltas[0].t - 1));
  for (let index = 0; index < deltas.length; index += 1) {
    total = total.plus(deltas[index].total);
    available = available.plus(deltas[index].available);
    turnover = turnover.plus(deltas[index].turnover);
    // Events a few milliseconds apart (a freeze and its expected-money row) are one moment.
    if (index === deltas.length - 1 || Math.floor(deltas[index + 1].t / 1000) !== Math.floor(deltas[index].t / 1000)) points.push(point(deltas[index].t));
  }
  if (!points.length || points[points.length - 1].t < nowT) points.push(point(nowT));
  return points;
}


/** One of the bank series as running-total chart points, each carrying its change since the previous point. */
export function bankSeries(points: BankPoint[], key: "total" | "available" | "turnover"): RangePoint[] {
  return points.map((point, index) => ({ t: point.t, total: point[key], delta: index ? point[key] - points[index - 1][key] : 0 }));
}

/** The bank series value at one moment: the last point at or before `t`; before the history starts, its first value. */
export function bankValueAt(points: BankPoint[], key: "total" | "available" | "turnover", t: number): number {
  if (!points.length) return 0;
  let value = points[0][key];
  for (const point of points) {
    if (point.t > t) break;
    value = point[key];
  }
  return value;
}

/** How much a bank series grew between two moments (the same window the chart's "Період" button shows). */
export function bankChange(points: BankPoint[], key: "total" | "available" | "turnover", from: number, to: number): number {
  return bankValueAt(points, key, to) - bankValueAt(points, key, from);
}
