import { prisma } from "@/lib/db";
import { getDashboard } from "@/lib/dashboard";
import { bearerToken, kyivStamp, TYPE_LABELS } from "@/lib/agent-query";
import type { TransactionQuery } from "@/lib/agent-query";
import { isValidSecretToken } from "@/lib/telegram/security";
import { isWorkExpenseTransaction } from "@/lib/transaction-utils";

/**
 * Read-only access for an external AI agent (OpenClaw). It never writes: the routes built on
 * this module only export GET, and every figure is computed by the same code the site uses.
 */

export type AgentAuth =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; error: string };

export async function authorizeAgent(request: Request, env: NodeJS.ProcessEnv = process.env): Promise<AgentAuth> {
  const expected = (env.FEELKY_AGENT_TOKEN || "").trim();
  // Fail closed: without a configured token the endpoints simply do not exist.
  if (!expected) return { ok: false, status: 503, error: "Agent access is not configured" };
  if (!isValidSecretToken(bearerToken(request.headers.get("authorization")), expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const email = (env.FEELKY_AGENT_USER_EMAIL || env.TELEGRAM_USER_EMAIL || "").trim().toLowerCase();
  if (!email) return { ok: false, status: 503, error: "Agent access is not configured" };
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: false, status: 503, error: "Agent access is not configured" };
  return { ok: true, userId: user.id };
}

export async function agentTransactions(userId: string, query: TransactionQuery) {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      archivedAt: null,
      transactionDate: { gte: query.from, lte: query.to },
      ...(query.type ? { type: query.type } : {})
    },
    orderBy: { transactionDate: "desc" },
    take: query.limit,
    include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true }
  });
  return {
    period: { from: kyivStamp(query.from), to: kyivStamp(query.to) },
    count: rows.length,
    limit: query.limit,
    transactions: rows.map((row) => ({
      date: kyivStamp(row.transactionDate),
      type: row.type,
      typeLabel: TYPE_LABELS[row.type],
      amount: row.amount.toString(),
      currency: row.currency,
      receivedAmount: row.convertedAmount?.toString() ?? null,
      receivedCurrency: row.convertedCurrency ?? null,
      rate: row.exchangeRate?.toString() ?? null,
      fromAccount: row.sourceAccount?.name ?? null,
      toAccount: row.destinationAccount?.name ?? null,
      category: row.category?.name ?? null,
      incomeSource: row.incomeSource?.name ?? null,
      isWorkExpense: isWorkExpenseTransaction(row),
      note: row.note ?? null
    }))
  };
}

export async function agentSummary(userId: string, month?: string | null) {
  const data = await getDashboard(userId, { month: month || undefined });
  return {
    period: { month: data.period.month, label: data.period.label, range: data.period.rangeLabel, isCurrentMonth: data.period.isCurrentMonth },
    rate: { uahPerUsdt: data.rate, source: data.rateSource },
    accounts: data.accounts.map((account) => ({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.currentBalance.toString(),
      // Set aside (savings, tithe): part of the full bank, never of available money.
      isReserved: account.isReserved
    })),
    totals: {
      availableBankUsdt: data.totals.availableBankUsdt,
      potentialBankUsdt: data.totals.potentialBankUsdt,
      monthIncomeUsdt: data.totals.monthIncomeUsdt,
      monthExpenseUah: data.totals.monthExpenseUah,
      monthlyExpenseLimitUah: data.settings?.monthlyExpenseLimit?.toString() ?? null,
      cardUah: data.totals.cardUah,
      cashUah: data.totals.cashUah,
      cashUsd: data.totals.cashUsd,
      savingsUah: data.totals.savingsUah,
      brokerUsdt: data.totals.brokerUsdt,
      cryptoUsdt: data.totals.cryptoTotal,
      frozenTotalUsdt: data.totals.frozenTotalUsdt,
      netPnlUsdt: data.totals.netPnlUsdt,
      p2pWithdrawals: data.totals.p2pCount,
      cashWithdrawals: data.totals.cashWithdrawalCount
    },
    expensesByCategoryUah: data.expenseCategories,
    workExpensesByDirectionUsdt: data.workExpenseSourcesUsdt,
    incomeBySourceUah: data.incomeSourcesUah,
    incomeBySourceUsdt: data.incomeSourcesUsdt,
    flips: {
      monthPnlUsdt: data.flips.monthPnl,
      totalPnlUsdt: data.flips.totalPnl,
      count: data.flips.count,
      winRatePercent: data.flips.winRate,
      bySetup: data.flips.setups
    },
    expectedMoney: data.expectedMoney.map((item) => ({
      title: item.title,
      amount: item.amount.toString(),
      currency: item.currency,
      status: item.status
    }))
  };
}
