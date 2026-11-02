import { ForkStatus, PolyTradeStatus, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { bagiraFee } from "@/lib/forks-config";
import { D } from "@/lib/money";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { SAVINGS_ACCOUNT_NAME, TITHE_ACCOUNT_NAME } from "@/lib/user-defaults";

const JAR_RATE = new Decimal("0.10");
const positive = (values: Decimal.Value[]) => values.reduce<Decimal>((sum, value) => {
  const amount = D(value);
  return amount.gt(0) ? sum.plus(amount) : sum;
}, D(0));

export function computeJarAccrual(input: {
  fx: Decimal.Value[];
  poly: Decimal.Value[];
  flips: Decimal.Value[];
  forks: Decimal.Value[];
}) {
  const fx = positive(input.fx);
  const poly = positive(input.poly);
  const flips = positive(input.flips);
  // Fork PnL is gross in the journal; only the amount left after Bagira's fee belongs to the user.
  const forks = input.forks.reduce<Decimal>((sum, value) => {
    const pnl = D(value);
    return pnl.gt(0) ? sum.plus(pnl.minus(bagiraFee(pnl))) : sum;
  }, D(0));
  const profit = fx.plus(poly).plus(flips).plus(forks);
  return {
    target: profit.times(JAR_RATE),
    profit,
    bySource: { fx, poly, flips, forks }
  };
}

export function jarProgress(target: Decimal.Value, balanceUsdt: Decimal.Value) {
  const required = D(target);
  const current = D(balanceUsdt);
  const missing = Decimal.max(required.minus(current), 0);
  const percent = required.gt(0) ? Decimal.min(current.div(required).times(100), 100) : D(100);
  return { missing, percent };
}

export async function getSavingsOverview(userId: string) {
  const [{ rate }, settings, accounts, fxTrades, polyTrades, flips, forks] = await Promise.all([
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.account.findMany({
      where: { userId, isActive: true, name: { in: [TITHE_ACCOUNT_NAME, SAVINGS_ACCOUNT_NAME] } },
      orderBy: { name: "asc" }
    }),
    prisma.fxTrade.findMany({ where: { userId }, select: { pnl: true } }),
    prisma.polyTrade.findMany({ where: { userId, status: { not: PolyTradeStatus.OPEN } }, select: { pnlUsd: true } }),
    prisma.flip.findMany({ where: { userId }, select: { pnl: true } }),
    prisma.forkTrade.findMany({ where: { userId, status: ForkStatus.SETTLED, pnl: { not: null } }, select: { pnl: true } })
  ]);
  const accrual = computeJarAccrual({
    fx: fxTrades.map((item) => item.pnl),
    poly: polyTrades.map((item) => item.pnlUsd),
    flips: flips.map((item) => item.pnl),
    forks: forks.flatMap((item) => item.pnl == null ? [] : [item.pnl])
  });

  const jars = await Promise.all([TITHE_ACCOUNT_NAME, SAVINGS_ACCOUNT_NAME].map(async (name) => {
    const account = accounts.find((item) => item.name === name);
    const transactions = account ? await prisma.transaction.findMany({
      where: {
        userId,
        archivedAt: null,
        type: TransactionType.TRANSFER,
        OR: [{ sourceAccountId: account.id }, { destinationAccountId: account.id }]
      },
      include: { sourceAccount: true, destinationAccount: true },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
    }) : [];
    const balanceUah = D(account?.currentBalance ?? 0);
    const balanceUsdt = balanceUah.div(rate);
    const withdrawnUah = transactions
      .filter((item) => item.sourceAccountId === account?.id)
      .reduce((sum, item) => sum.plus(item.amount), D(0));
    const depositedUah = transactions
      .filter((item) => item.destinationAccountId === account?.id)
      .reduce((sum, item) => sum.plus(item.amount), D(0));
    const progress = jarProgress(accrual.target, balanceUsdt);
    return {
      name,
      accountExists: Boolean(account),
      balanceUah: balanceUah.toString(),
      balanceUsdt: balanceUsdt.toString(),
      depositedUah: depositedUah.toString(),
      withdrawnUah: withdrawnUah.toString(),
      targetUsdt: accrual.target.toString(),
      missingUsdt: progress.missing.toString(),
      progress: progress.percent.toNumber(),
      transactions
    };
  }));

  return {
    jars,
    rate: rate.toString(),
    hidden: Boolean(settings?.hideAmounts),
    profitUsdt: accrual.profit.toString(),
    targetPerJarUsdt: accrual.target.toString(),
    bySource: Object.fromEntries(Object.entries(accrual.bySource).map(([key, value]) => [key, value.toString()]))
  };
}
