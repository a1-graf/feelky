import { TransactionType } from "@prisma/client";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { D } from "@/lib/money";
import { resolvePeriod, type PeriodInput } from "@/lib/period";
import { isWorkExpenseTransaction } from "@/lib/transaction-utils";

const add = (map: Map<string, Decimal>, key: string, value: Decimal) => map.set(key, (map.get(key) ?? D(0)).plus(value));
const ranked = (map: Map<string, Decimal>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value: value.toNumber() }))
    .sort((a, b) => b.value - a.value);

/** Period totals and all-time chart data for the Expenses page, normalized to USDT at the active rate. */
export async function getExpensesPage(userId: string, input: PeriodInput = {}) {
  const period = resolvePeriod(input);
  const [{ rate }, settings, transactions] = await Promise.all([
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: TransactionType.EXPENSE },
      include: { sourceAccount: true, category: true, incomeSource: true },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const toUsdt = (item: { amount: Decimal.Value; currency: string }) => (item.currency === "UAH" ? D(item.amount).div(rate) : D(item.amount));
  const inPeriod = transactions.filter((item) => item.transactionDate >= period.from && item.transactionDate <= period.to);
  const byCategory = new Map<string, Decimal>();
  const byType = new Map<string, Decimal>();
  let personalUah = D(0);
  let workUsdt = D(0);
  let totalUsdt = D(0);

  for (const item of inPeriod) {
    const value = toUsdt(item);
    const work = isWorkExpenseTransaction(item);
    totalUsdt = totalUsdt.plus(value);
    if (work) {
      workUsdt = workUsdt.plus(value);
      add(byCategory, `Робочі · ${item.incomeSource?.name || "Без напрямку"}`, value);
      add(byType, "Робочі", value);
    } else {
      if (item.currency === "UAH") personalUah = personalUah.plus(item.amount);
      add(byCategory, item.category?.name || "Без категорії", value);
      add(byType, "Особисті", value);
    }
  }

  let running = D(0);
  const series = [...transactions].reverse().map((item) => {
    const value = toUsdt(item);
    running = running.plus(value);
    return {
      t: item.transactionDate.getTime(),
      delta: value.toNumber(),
      total: running.toNumber(),
      label: isWorkExpenseTransaction(item) ? item.incomeSource?.name ?? "Робочі" : item.category?.name ?? "Без категорії"
    };
  });

  const effectiveFrom = period.key === "all" && inPeriod.length
    ? inPeriod[inPeriod.length - 1].transactionDate
    : period.from;
  const days = Math.max(1, Math.ceil((period.to.getTime() - effectiveFrom.getTime()) / 86_400_000));
  return {
    period,
    rate: rate.toString(),
    hidden: Boolean(settings?.hideAmounts),
    totals: {
      totalUsdt: totalUsdt.toString(),
      personalUah: personalUah.toString(),
      workUsdt: workUsdt.toString(),
      dailyAverageUsdt: totalUsdt.div(days).toString(),
      count: inPeriod.length
    },
    series,
    byCategory: ranked(byCategory),
    byType: ranked(byType),
    recent: inPeriod.slice(0, 50)
  };
}
