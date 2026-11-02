import { TransactionType } from "@prisma/client";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { D } from "@/lib/money";
import { resolvePeriod, type PeriodInput } from "@/lib/period";

const TYPES = [TransactionType.P2P_WITHDRAWAL, TransactionType.P2P_DEPOSIT, TransactionType.CASH_WITHDRAWAL];
const add = (map: Map<string, Decimal>, key: string, value: Decimal) => map.set(key, (map.get(key) ?? D(0)).plus(value));
const ranked = (map: Map<string, Decimal>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value: value.toNumber() }))
    .sort((a, b) => b.value - a.value);

/** Conversion-flow analytics for P2P/cash withdrawals and P2P deposits. */
export async function getWithdrawalsPage(userId: string, input: PeriodInput = {}) {
  const period = resolvePeriod(input);
  const [{ rate }, settings, transactions] = await Promise.all([
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: { in: TYPES } },
      include: { sourceAccount: true, destinationAccount: true },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const inPeriod = transactions.filter((item) => item.transactionDate >= period.from && item.transactionDate <= period.to);
  const volumeUsdt = (item: (typeof transactions)[number]) => {
    if (item.type === TransactionType.P2P_DEPOSIT) return D(item.convertedAmount || 0);
    return item.currency === "UAH" ? D(item.amount).div(rate) : D(item.amount);
  };
  const byType = new Map<string, Decimal>();
  const byDestination = new Map<string, Decimal>();
  let spentUsdt = D(0);
  let receivedUah = D(0);
  let receivedUsd = D(0);
  let depositedUah = D(0);
  let depositedUsdt = D(0);
  let weightedRateVolume = D(0);
  let rateWeight = D(0);

  for (const item of inPeriod) {
    const volume = volumeUsdt(item);
    const typeLabel = item.type === TransactionType.P2P_DEPOSIT ? "P2P-заводи" : item.type === TransactionType.CASH_WITHDRAWAL ? "Готівкові виводи" : "P2P-виводи";
    add(byType, typeLabel, volume);
    add(byDestination, item.destinationAccount?.name || (item.type === TransactionType.CASH_WITHDRAWAL ? "Готівка" : "Без рахунку"), volume);
    if (item.type === TransactionType.P2P_DEPOSIT) {
      depositedUah = depositedUah.plus(item.amount);
      depositedUsdt = depositedUsdt.plus(item.convertedAmount || 0);
    } else {
      spentUsdt = spentUsdt.plus(volume);
      if (item.convertedCurrency === "UAH") receivedUah = receivedUah.plus(item.convertedAmount || 0);
      if (item.convertedCurrency === "USD") receivedUsd = receivedUsd.plus(item.convertedAmount || 0);
    }
    const isUahRate = item.type === TransactionType.P2P_DEPOSIT || item.convertedCurrency === "UAH";
    if (isUahRate && item.exchangeRate && volume.gt(0)) {
      weightedRateVolume = weightedRateVolume.plus(D(item.exchangeRate).times(volume));
      rateWeight = rateWeight.plus(volume);
    }
  }

  let running = D(0);
  const series = [...transactions].reverse().map((item) => {
    const value = volumeUsdt(item);
    running = running.plus(value);
    return {
      t: item.transactionDate.getTime(),
      delta: value.toNumber(),
      total: running.toNumber(),
      label: item.type === TransactionType.P2P_DEPOSIT ? "P2P-завод" : item.type === TransactionType.CASH_WITHDRAWAL ? "Готівка" : "P2P-вивід"
    };
  });

  return {
    period,
    hidden: Boolean(settings?.hideAmounts),
    totals: {
      spentUsdt: spentUsdt.toString(),
      receivedUah: receivedUah.toString(),
      receivedUsd: receivedUsd.toString(),
      depositedUah: depositedUah.toString(),
      depositedUsdt: depositedUsdt.toString(),
      averageRate: rateWeight.gt(0) ? weightedRateVolume.div(rateWeight).toString() : "0",
      count: inPeriod.length
    },
    series,
    byType: ranked(byType),
    byDestination: ranked(byDestination),
    recent: inPeriod.slice(0, 50)
  };
}
