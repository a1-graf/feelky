import { PolyTradeStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { D } from "@/lib/money";
import { resolvePeriod, type PeriodInput } from "@/lib/period";
import { isFlipLedgerTransaction, isOpeningBalanceTransaction } from "@/lib/transaction-utils";
import type Decimal from "decimal.js";

const sumTo = (map: Map<string, Decimal>, key: string, value: Decimal) => map.set(key, (map.get(key) ?? D(0)).plus(value));
const ranked = (map: Map<string, Decimal>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value: value.toNumber() }))
    .sort((a, b) => b.value - a.value);

/** Everything the Income page shows: totals split by currency, an all-time running series and the period's breakdowns (USDT, UAH converted at the stored rate). */
export async function getIncomePage(userId: string, input: PeriodInput = {}) {
  const period = resolvePeriod(input);
  const [{ rate }, settings, transactions, flips, fxTrades, polyTrades] = await Promise.all([
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: { in: [TransactionType.INCOME, TransactionType.EXPECTED_MONEY_RECEIVED] } },
      include: { destinationAccount: true, incomeSource: true },
      orderBy: { transactionDate: "desc" }
    }),
    prisma.flip.findMany({ where: { userId, tradeDate: period.range }, select: { pnl: true } }),
    prisma.fxTrade.findMany({ where: { userId, closedAt: period.range }, select: { pnl: true } }),
    prisma.polyTrade.findMany({
      where: { userId, status: { not: PolyTradeStatus.OPEN }, OR: [{ resolvedAt: period.range }, { resolvedAt: null, openedAt: period.range }] },
      select: { pnlUsd: true }
    })
  ]);

  const real = transactions.filter((item) => !isOpeningBalanceTransaction(item));
  const toUsdt = (item: { amount: Decimal.Value; currency: string }) => (item.currency === "UAH" ? D(item.amount).div(rate) : D(item.amount));
  const inPeriod = real.filter((item) => item.transactionDate >= period.from && item.transactionDate <= period.to);

  let uah = D(0);
  let usdt = D(0);
  const bySource = new Map<string, Decimal>();
  const byType = new Map<string, Decimal>();
  let steam = D(0);
  for (const item of inPeriod) {
    if (item.currency === "UAH") uah = uah.plus(item.amount);
    else usdt = usdt.plus(item.amount);
    const value = toUsdt(item);
    const sourceName = item.incomeSource?.name || "Без джерела";
    sumTo(bySource, sourceName, value);
    const kind = isFlipLedgerTransaction(item) ? "Фліпи" : item.type === TransactionType.EXPECTED_MONEY_RECEIVED ? "Очікувані гроші" : "Звичайний дохід";
    sumTo(byType, kind, value);
    const steamType = (item.metadata as Record<string, unknown> | null)?.steamType;
    if (sourceName === "Steam" || steamType) steam = steam.plus(value);
  }

  // Oldest first, so the chart can accumulate; the hand-off list stays newest first.
  let running = D(0);
  const series = [...real].reverse().map((item) => {
    const value = toUsdt(item);
    running = running.plus(value);
    return { t: item.transactionDate.getTime(), delta: value.toNumber(), total: running.toNumber(), label: item.incomeSource?.name ?? undefined };
  });

  const sum = (values: Decimal.Value[]) => values.reduce<Decimal>((total, value) => total.plus(value), D(0));
  const modules = [
    { name: "Aurum (Forex)", value: sum(fxTrades.map((trade) => trade.pnl)).toNumber() },
    { name: "Polymarket", value: sum(polyTrades.map((trade) => trade.pnlUsd)).toNumber() },
    { name: "Steam", value: steam.toNumber() },
    { name: "Фліпи", value: sum(flips.map((flip) => flip.pnl)).toNumber() }
  ];

  return {
    period,
    rate: rate.toString(),
    hidden: Boolean(settings?.hideAmounts),
    totals: { uah: uah.toString(), usdt: usdt.toString(), totalUsdt: uah.div(rate).plus(usdt).toString(), count: inPeriod.length },
    series,
    bySource: ranked(bySource),
    byType: ranked(byType),
    modules,
    recent: inPeriod.slice(0, 20)
  };
}
