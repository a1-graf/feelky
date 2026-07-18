import { AccountType, ExpectedMoneyStatus, FrozenFundStatus, RateMode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { summarizeFlips } from "@/lib/flips";
import { D } from "@/lib/money";
import { steamAnalytics } from "@/lib/steam";
import { isFlipLedgerTransaction, isOpeningBalanceTransaction, isWorkExpenseTransaction } from "@/lib/transaction-utils";
import { SAVINGS_ACCOUNT_NAME } from "@/lib/user-defaults";

type DashboardPeriod = {
  month?: string;
};

function localDate(year: number, monthIndex: number, day: number, endOfDay = false) {
  const date = new Date(year, monthIndex, day);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function resolveDashboardPeriod(input: DashboardPeriod = {}) {
  const now = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(input.month || "");
  const parsedMonth = match ? Number(match[2]) : null;
  const hasValidMonth = Boolean(match && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12);
  const year = hasValidMonth ? Number(match![1]) : now.getFullYear();
  const monthIndex = hasValidMonth ? Number(match![2]) - 1 : now.getMonth();
  const normalizedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const from = localDate(year, monthIndex, 1);
  const nextMonthStart = localDate(year, monthIndex + 1, 1);
  const currentMonthStart = localDate(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonth = from.getTime() === currentMonthStart.getTime();
  const to = isCurrentMonth ? now : new Date(nextMonthStart.getTime() - 1);
  const range = { gte: from, lte: to };
  const formatter = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return {
    month: normalizedMonth,
    from,
    to,
    isCurrentMonth,
    label: new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(from),
    rangeLabel: `${formatter.format(from)} - ${formatter.format(to)}`,
    range
  };
}

export async function resolveUahUsdtRate(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  if (settings?.rateMode === RateMode.MANUAL && settings.manualUahUsdtRate) {
    return { rate: D(settings.manualUahUsdtRate), source: "Ручний курс" };
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const p2p = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.P2P_WITHDRAWAL,
      archivedAt: null,
      transactionDate: { gte: since },
      exchangeRate: { not: null }
    },
    select: { exchangeRate: true }
  });

  if ((settings?.rateMode === RateMode.P2P_AVERAGE || !settings) && p2p.length) {
    const rate = p2p.reduce((sum, item) => sum.plus(item.exchangeRate || 0), new Decimal(0)).div(p2p.length);
    return { rate, source: "Середній P2P за 30 днів" };
  }

  return { rate: new Decimal(40), source: "Fallback market provider" };
}

export async function getDashboard(userId: string, input: DashboardPeriod = {}) {
  const period = resolveDashboardPeriod(input);
  const [accounts, frozenFunds, expectedMoney, allExpectedMoney, settings, recentTransactions, expenseTransactions, incomeTransactions, balanceTransactions, flips, rateData, steam, periodTransactions] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true }, include: { childAccounts: true }, orderBy: { createdAt: "asc" } }),
    prisma.frozenFund.findMany({ where: { userId, status: FrozenFundStatus.FROZEN } }),
    prisma.expectedMoney.findMany({
      where: { userId, status: { in: [ExpectedMoneyStatus.EXPECTED, ExpectedMoneyStatus.NEED_TO_COLLECT, ExpectedMoneyStatus.IN_PROGRESS] } }
    }),
    prisma.expectedMoney.findMany({ where: { userId } }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, transactionDate: period.range },
      orderBy: { transactionDate: "desc" },
      take: 20,
      include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: TransactionType.EXPENSE, transactionDate: period.range },
      orderBy: { transactionDate: "desc" },
      include: { category: true, incomeSource: true }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: { in: [TransactionType.INCOME, TransactionType.EXPECTED_MONEY_RECEIVED] }, transactionDate: period.range },
      orderBy: { transactionDate: "desc" },
      include: { incomeSource: true }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.flip.findMany({
      where: { userId, tradeDate: period.range },
      orderBy: { tradeDate: "desc" }
    }),
    resolveUahUsdtRate(userId),
    steamAnalytics.dashboard(userId, { from: period.from, to: period.to }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, transactionDate: period.range }
    })
  ]);

  const { rate, source } = rateData;
  const asUsdt = (amount: Decimal.Value, currency: string) => {
    if (currency === "UAH") return D(amount).div(rate);
    return D(amount);
  };
  const metadataObject = (metadata: unknown) => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
    return metadata as Record<string, unknown>;
  };
  const decimalFromMetadata = (metadata: unknown, key: string) => {
    const value = metadataObject(metadata)?.[key];
    return typeof value === "string" || typeof value === "number" ? D(value) : null;
  };
  const frozenByAccount = new Map<string, Decimal>();
  for (const frozen of frozenFunds) {
    frozenByAccount.set(frozen.accountId, D(frozenByAccount.get(frozen.accountId) || 0).plus(frozen.amount));
  }

  const cryptoTypes: AccountType[] = [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET];
  const cryptoAccounts = accounts.filter((account) => cryptoTypes.includes(account.type));
  const bankCards = accounts.filter((account) => account.type === AccountType.BANK_CARD);
  const cashAccounts = accounts.filter((account) => account.type === AccountType.CASH);
  const savingsAccount = accounts.find((account) => account.name === SAVINGS_ACCOUNT_NAME && account.currency === "UAH");

  const cryptoTotal = cryptoAccounts.reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const frozenCrypto = frozenFunds.filter((fund) => fund.currency === "USDT").reduce((sum, fund) => sum.plus(fund.amount), new Decimal(0));
  const availableCrypto = cryptoTotal.minus(frozenCrypto);
  const cardUah = bankCards.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUah = cashAccounts.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUsd = cashAccounts.filter((account) => account.currency === "USD").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const savingsUah = D(savingsAccount?.currentBalance || 0);
  const uahAsUsdt = cardUah.plus(cashUah).div(rate);
  const savingsAsUsdt = savingsUah.div(rate);
  const cashUsdAsUsdt = cashUsd;
  const availableBankUsdt = availableCrypto.plus(uahAsUsdt).plus(cashUsdAsUsdt);
  const potentialExpected = expectedMoney.reduce((sum, item) => {
    if (item.currency === "UAH") return sum.plus(D(item.amount).div(rate));
    return sum.plus(item.amount);
  }, new Decimal(0));
  const frozenTotalUsdt = frozenCrypto.plus(potentialExpected);
  const steamFrozenCapital = D(steam.totals.frozenCapital);
  const potentialBankUsdt = availableBankUsdt.plus(savingsAsUsdt).plus(frozenCrypto).plus(potentialExpected).plus(steamFrozenCapital);
  const availableWithTurnoverUsdt = availableBankUsdt.plus(steamFrozenCapital);

  const monthIncome = periodTransactions
    .filter((t) => !isOpeningBalanceTransaction(t) && (t.type === TransactionType.INCOME || t.type === TransactionType.EXPECTED_MONEY_RECEIVED))
    .reduce((sum, t) => sum.plus(t.currency === "UAH" ? D(t.amount).div(rate) : t.amount), new Decimal(0));
  const monthExpenseUah = periodTransactions
    .filter((t) => t.type === TransactionType.EXPENSE && t.currency === "UAH")
    .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const p2pCount = periodTransactions.filter((t) => t.type === TransactionType.P2P_WITHDRAWAL).length;
  const cashWithdrawalCount = periodTransactions.filter((t) => t.type === TransactionType.CASH_WITHDRAWAL).length;
  const flipStatistics = summarizeFlips(flips);
  const expenseCategoryMap = new Map<string, Decimal>();
  const workExpenseSourceMap = new Map<string, Decimal>();
  for (const transaction of expenseTransactions) {
    if (isWorkExpenseTransaction(transaction)) {
      const label = transaction.incomeSource?.name || "Без напрямку";
      const amountUsdt = transaction.currency === "UAH" ? D(transaction.amount).div(rate) : D(transaction.amount);
      workExpenseSourceMap.set(label, D(workExpenseSourceMap.get(label) || 0).plus(amountUsdt));
    } else if (transaction.currency === "UAH") {
      const label = transaction.category?.name || "Без категорії";
      expenseCategoryMap.set(label, D(expenseCategoryMap.get(label) || 0).plus(transaction.amount));
    }
  }
  for (const flip of flips) {
    const pnl = D(flip.pnl);
    if (pnl.lt(0)) {
      const label = `Фліпи · ${flip.setup}`;
      workExpenseSourceMap.set(label, D(workExpenseSourceMap.get(label) || 0).plus(pnl.abs()));
    }
  }
  const expenseCategories = Array.from(expenseCategoryMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const workExpenseSourcesUsdt = Array.from(workExpenseSourceMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const incomeSourceUahMap = new Map<string, Decimal>();
  const incomeSourceUsdtMap = new Map<string, Decimal>();
  const incomeTimelineMap = new Map<string, { label: string; usdt: Decimal; uah: Decimal }>();
  const incomeSourceTimelineMap = new Map<string, { label: string; sources: Map<string, Decimal> }>();
  for (const transaction of incomeTransactions.filter((item) => !isOpeningBalanceTransaction(item))) {
    const label = transaction.incomeSource?.name || "\u0411\u0435\u0437 \u0434\u0436\u0435\u0440\u0435\u043b\u0430";
    const dateKey = transaction.transactionDate.toISOString().slice(0, 10);
    const formattedDate = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(transaction.transactionDate);
    const timelinePoint =
      incomeTimelineMap.get(dateKey) ||
      {
        label: formattedDate,
        usdt: new Decimal(0),
        uah: new Decimal(0)
      };
    const sourceTimelinePoint = incomeSourceTimelineMap.get(dateKey) || { label: formattedDate, sources: new Map<string, Decimal>() };
    const amountInUsdt = transaction.currency === "UAH" ? D(transaction.amount).div(rate) : D(transaction.amount);
    sourceTimelinePoint.sources.set(label, D(sourceTimelinePoint.sources.get(label) || 0).plus(amountInUsdt));
    if (transaction.currency === "USDT" || transaction.currency === "USD") {
      incomeSourceUsdtMap.set(label, D(incomeSourceUsdtMap.get(label) || 0).plus(transaction.amount));
      timelinePoint.usdt = timelinePoint.usdt.plus(transaction.amount);
    } else if (transaction.currency === "UAH") {
      incomeSourceUahMap.set(label, D(incomeSourceUahMap.get(label) || 0).plus(transaction.amount));
      timelinePoint.uah = timelinePoint.uah.plus(transaction.amount);
    }
    incomeTimelineMap.set(dateKey, timelinePoint);
    incomeSourceTimelineMap.set(dateKey, sourceTimelinePoint);
  }
  const incomeSourcesUah = Array.from(incomeSourceUahMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const incomeSourcesUsdt = Array.from(incomeSourceUsdtMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const incomeTimeline = Array.from(incomeTimelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: value.label,
      usdt: value.usdt.toNumber(),
      uah: value.uah.toNumber()
    }));
  const incomeSourceTimeline = Array.from(incomeSourceTimelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: value.label,
      sources: Array.from(value.sources.entries()).map(([name, amount]) => ({ name, value: amount.toNumber() }))
    }));

  const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dateFormatter = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" });
  const lossBreakdownMap = new Map<string, Decimal>();
  const pnlEvents: { date: Date; profit: Decimal; loss: Decimal; net: Decimal }[] = [];
  const addPnlEvent = (date: Date, amount: Decimal, lossLabel?: string) => {
    pnlEvents.push({
      date,
      profit: amount.gt(0) ? amount : new Decimal(0),
      loss: amount.lt(0) ? amount.abs() : new Decimal(0),
      net: amount
    });
    if (amount.lt(0) && lossLabel) {
      lossBreakdownMap.set(lossLabel, D(lossBreakdownMap.get(lossLabel) || 0).plus(amount.abs()));
    }
  };
  for (const transaction of incomeTransactions.filter((item) => !isOpeningBalanceTransaction(item) && !isFlipLedgerTransaction(item))) {
    const metadata = metadataObject(transaction.metadata);
    let amount = asUsdt(transaction.amount, transaction.currency);
    let lossLabel = transaction.incomeSource?.name ? `Дохід · ${transaction.incomeSource.name}` : "Дохід · Без джерела";
    if (metadata?.steamType === "ARBITRAGE_COMPLETION") {
      amount = decimalFromMetadata(transaction.metadata, "profit") || amount;
      lossLabel = "Steam · Арбітраж";
    } else if (metadata?.steamType === "RESALE_WITHDRAWAL") {
      const softwareAmountSpent = decimalFromMetadata(transaction.metadata, "softwareAmountSpent");
      if (softwareAmountSpent) amount = amount.minus(softwareAmountSpent);
      lossLabel = "Steam · Перепродаж";
    }
    addPnlEvent(transaction.transactionDate, amount, lossLabel);
  }
  for (const transaction of expenseTransactions.filter((item) => !isFlipLedgerTransaction(item))) {
    const label = isWorkExpenseTransaction(transaction)
      ? `Робочі · ${transaction.incomeSource?.name || "Без напрямку"}`
      : `Витрати · ${transaction.category?.name || "Без категорії"}`;
    addPnlEvent(transaction.transactionDate, asUsdt(transaction.amount, transaction.currency).negated(), label);
  }
  for (const flip of flips) {
    addPnlEvent(flip.tradeDate, D(flip.pnl), `Фліпи · ${flip.setup}`);
  }
  const totalProfitUsdt = pnlEvents.reduce((sum, event) => sum.plus(event.profit), new Decimal(0));
  const totalLossUsdt = pnlEvents.reduce((sum, event) => sum.plus(event.loss), new Decimal(0));
  const netPnlUsdt = pnlEvents.reduce((sum, event) => sum.plus(event.net), new Decimal(0));
  const lossBreakdown = Array.from(lossBreakdownMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 10);
  let runningProfit = new Decimal(0);
  let runningLoss = new Decimal(0);
  let runningNet = new Decimal(0);
  const pnlByDate = new Map<string, { label: string; profit: Decimal; loss: Decimal; net: Decimal }>();
  for (const event of pnlEvents) {
    const date = event.date.toISOString().slice(0, 10);
    const current = pnlByDate.get(date) || { label: dateFormatter.format(event.date), profit: new Decimal(0), loss: new Decimal(0), net: new Decimal(0) };
    current.profit = current.profit.plus(event.profit);
    current.loss = current.loss.plus(event.loss);
    current.net = current.net.plus(event.net);
    pnlByDate.set(date, current);
  }
  const pnlTimeline = Array.from(pnlByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, event]) => {
      runningProfit = runningProfit.plus(event.profit);
      runningLoss = runningLoss.plus(event.loss);
      runningNet = runningNet.plus(event.net);
      return {
        date,
        label: event.label,
        profit: event.profit.toNumber(),
        loss: event.loss.toNumber(),
        net: runningNet.toNumber()
      };
    });
  const balanceEvents: { date: Date; fullDelta: Decimal; availableDelta: Decimal }[] = [];
  for (const transaction of balanceTransactions) {
    const amount = asUsdt(transaction.amount, transaction.currency);
    const comesFromSavings = Boolean(savingsAccount && transaction.sourceAccountId === savingsAccount.id);
    const goesToSavings = Boolean(savingsAccount && transaction.destinationAccountId === savingsAccount.id);
    if (transaction.type === TransactionType.INCOME) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: amount, availableDelta: goesToSavings ? new Decimal(0) : amount });
    } else if (transaction.type === TransactionType.EXPECTED_MONEY_RECEIVED) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: new Decimal(0), availableDelta: goesToSavings ? new Decimal(0) : amount });
    } else if (transaction.type === TransactionType.EXPENSE) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: amount.negated(), availableDelta: comesFromSavings ? new Decimal(0) : amount.negated() });
    } else if (transaction.type === TransactionType.MANUAL_ADJUSTMENT) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: amount, availableDelta: goesToSavings ? new Decimal(0) : amount });
    } else if (transaction.type === TransactionType.TRANSFER && comesFromSavings !== goesToSavings) {
      balanceEvents.push({
        date: transaction.transactionDate,
        fullDelta: new Decimal(0),
        availableDelta: goesToSavings ? amount.negated() : amount
      });
    } else if (transaction.type === TransactionType.FUNDS_FROZEN) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: new Decimal(0), availableDelta: amount.negated() });
    } else if (transaction.type === TransactionType.FUNDS_RELEASED) {
      balanceEvents.push({ date: transaction.transactionDate, fullDelta: new Decimal(0), availableDelta: amount });
    }
  }
  for (const item of allExpectedMoney) {
    balanceEvents.push({ date: item.createdAt, fullDelta: asUsdt(item.amount, item.currency), availableDelta: new Decimal(0) });
    if ((item.status === ExpectedMoneyStatus.LOST || item.status === ExpectedMoneyStatus.SCAMMED) && item.resolvedAt) {
      balanceEvents.push({ date: item.resolvedAt, fullDelta: asUsdt(item.amount, item.currency).negated(), availableDelta: new Decimal(0) });
    }
  }
  const totalFullDelta = balanceEvents.reduce((sum, event) => sum.plus(event.fullDelta), new Decimal(0));
  const totalAvailableDelta = balanceEvents.reduce((sum, event) => sum.plus(event.availableDelta), new Decimal(0));
  let runningFull = potentialBankUsdt.minus(totalFullDelta);
  let runningAvailable = availableWithTurnoverUsdt.minus(totalAvailableDelta);
  const balanceTimeline = balanceEvents
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((event, index) => {
      runningFull = runningFull.plus(event.fullDelta);
      runningAvailable = runningAvailable.plus(event.availableDelta);
      return {
        date: event.date.toISOString(),
        label: dateFormatter.format(event.date),
        tooltipLabel: dateTimeFormatter.format(event.date),
        eventIndex: index + 1,
        full: runningFull.toNumber(),
        available: runningAvailable.toNumber()
      };
    });
  if (!balanceTimeline.length) {
    const today = new Date();
    balanceTimeline.push({
      date: today.toISOString(),
      label: dateFormatter.format(today),
      tooltipLabel: dateTimeFormatter.format(today),
      eventIndex: 1,
      full: potentialBankUsdt.toNumber(),
      available: availableWithTurnoverUsdt.toNumber()
    });
  }
  return {
    period: {
      month: period.month,
      label: period.label,
      rangeLabel: period.rangeLabel,
      isCurrentMonth: period.isCurrentMonth
    },
    settings,
    rate: rate.toString(),
    rateSource: source,
    accounts,
    frozenByAccount,
    expectedMoney,
    recentTransactions: recentTransactions.filter((item) => !isOpeningBalanceTransaction(item)).slice(0, 8),
    expenseCategories,
    workExpenseSourcesUsdt,
    incomeSourcesUah,
    incomeSourcesUsdt,
    incomeTimeline,
    incomeSourceTimeline,
    pnlTimeline,
    lossBreakdown,
    balanceTimeline,
    flips: flipStatistics,
    steam: {
      frozenCapital: steamFrozenCapital.toString(),
      profit: steam.totals.steamProfit
    },
    totals: {
      cryptoTotal: cryptoTotal.toString(),
      availableCrypto: availableCrypto.toString(),
      frozenCrypto: frozenCrypto.toString(),
      frozenTotalUsdt: frozenTotalUsdt.toString(),
      cardUah: cardUah.toString(),
      cashUah: cashUah.toString(),
      cashUsd: cashUsd.toString(),
      savingsUah: savingsUah.toString(),
      availableBankUsdt: availableBankUsdt.toString(),
      potentialBankUsdt: potentialBankUsdt.toString(),
      monthIncomeUsdt: monthIncome.toString(),
      monthExpenseUah: monthExpenseUah.toString(),
      totalProfitUsdt: totalProfitUsdt.toString(),
      totalLossUsdt: totalLossUsdt.toString(),
      netPnlUsdt: netPnlUsdt.toString(),
      p2pCount,
      cashWithdrawalCount
    }
  };
}
