import { AccountType, ExpectedMoneyStatus, FrozenFundStatus, RateMode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { buildBankHistory } from "@/lib/bank-history";
import { resolvePeriod, type PeriodInput } from "@/lib/period";
import { summarizeFlips } from "@/lib/flips";
import { D } from "@/lib/money";
import { steamAnalytics } from "@/lib/steam";
import { isFlipLedgerTransaction, isOpeningBalanceTransaction, isWorkExpenseTransaction } from "@/lib/transaction-utils";

type DashboardPeriod = PeriodInput;

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
  const period = resolvePeriod(input);
  const [accounts, frozenFunds, expectedMoney, allExpectedMoney, settings, recentTransactions, allTransactions, allFlips, rateData, steam, polyLocks, steamInvestments, steamRounds, steamWithdrawals] = await Promise.all([
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
      where: { userId, archivedAt: null },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: { category: true, incomeSource: true }
    }),
    prisma.flip.findMany({ where: { userId }, orderBy: { tradeDate: "desc" } }),
    resolveUahUsdtRate(userId),
    steamAnalytics.dashboard(userId, { from: period.from, to: period.to }),
    prisma.polyLock.findMany({ where: { userId } }),
    prisma.steamResaleInvestment.findMany({ where: { userId, archivedAt: null } }),
    prisma.steamArbitrageRound.findMany({ where: { userId, archivedAt: null } }),
    prisma.steamResaleWithdrawal.findMany({ where: { userId, archivedAt: null, transactionId: null } })
  ]);

  const { rate, source } = rateData;
  const inPeriod = (date: Date) => date >= period.from && date <= period.to;
  const balanceTransactions = allTransactions;
  const periodTransactions = allTransactions.filter((t) => inPeriod(t.transactionDate));
  const expenseTransactions = periodTransactions.filter((t) => t.type === TransactionType.EXPENSE);
  const incomeTransactions = periodTransactions.filter(
    (t) => t.type === TransactionType.INCOME || t.type === TransactionType.EXPECTED_MONEY_RECEIVED
  );
  const flips = allFlips.filter((flip) => inPeriod(flip.tradeDate));
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

  // Set-aside accounts (savings, a tithe jar) are in the full bank but never in available money,
  // whatever their type - so they are taken out before cards, cash and crypto are summed.
  const reservedAccounts = accounts.filter((account) => account.isReserved);
  const reservedIds = new Set(reservedAccounts.map((account) => account.id));
  const spendable = accounts.filter((account) => !account.isReserved);
  const cryptoTypes: AccountType[] = [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET];
  // The Polymarket pool is money at work, not spendable: it sits in "в обороті" next to Steam and the broker.
  const polyPoolId = `${userId}-polymarket`;
  const polyPoolAccounts = spendable.filter((account) => account.id === polyPoolId);
  const cryptoAccounts = spendable.filter((account) => cryptoTypes.includes(account.type) && account.id !== polyPoolId);
  const bankCards = spendable.filter((account) => account.type === AccountType.BANK_CARD);
  const cashAccounts = spendable.filter((account) => account.type === AccountType.CASH);
  const brokerAccounts = spendable.filter((account) => account.type === AccountType.BROKER);

  const cryptoTotal = cryptoAccounts.reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const frozenCrypto = frozenFunds.filter((fund) => fund.currency === "USDT").reduce((sum, fund) => sum.plus(fund.amount), new Decimal(0));
  const availableCrypto = cryptoTotal.minus(frozenCrypto);
  const cardUah = bankCards.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUah = cashAccounts.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUsd = cashAccounts.filter((account) => account.currency === "USD").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const savingsUah = reservedAccounts
    .filter((account) => account.currency === "UAH")
    .reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const reservedForeignUsdt = reservedAccounts
    .filter((account) => account.currency !== "UAH")
    .reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  // Money sitting at a broker is trading capital: part of the full bank, like Steam turnover.
  const brokerUsdt = brokerAccounts.reduce(
    (sum, account) => sum.plus(account.currency === "UAH" ? D(account.currentBalance).div(rate) : account.currentBalance),
    new Decimal(0)
  );
  const polyPoolUsdt = polyPoolAccounts.reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const uahAsUsdt = cardUah.plus(cashUah).div(rate);
  const savingsAsUsdt = savingsUah.div(rate).plus(reservedForeignUsdt);
  const cashUsdAsUsdt = cashUsd;
  const availableBankUsdt = availableCrypto.plus(uahAsUsdt).plus(cashUsdAsUsdt);
  const potentialExpected = expectedMoney.reduce((sum, item) => {
    if (item.currency === "UAH") return sum.plus(D(item.amount).div(rate));
    return sum.plus(item.amount);
  }, new Decimal(0));
  const frozenTotalUsdt = frozenCrypto.plus(potentialExpected);
  const steamFrozenCapital = D(steam.totals.frozenCapital);
  // Principal locked in Polymarket AI agents left the pool but is still the user's money, like Steam turnover.
  const polyLockedUsdt = polyLocks.filter((lock) => lock.status === "LOCKED").reduce((sum, lock) => sum.plus(lock.amountUsd), new Decimal(0));
  const polyLocksById = new Map(polyLocks.map((lock) => [lock.id, lock]));
  const potentialBankUsdt = availableBankUsdt.plus(savingsAsUsdt).plus(frozenCrypto).plus(potentialExpected).plus(steamFrozenCapital).plus(brokerUsdt).plus(polyLockedUsdt).plus(polyPoolUsdt);
  const availableWithTurnoverUsdt = availableBankUsdt.plus(steamFrozenCapital).plus(brokerUsdt).plus(polyLockedUsdt).plus(polyPoolUsdt);
  const polyTurnoverUsdt = polyPoolUsdt.plus(polyLockedUsdt);
  const turnoverUsdt = steamFrozenCapital.plus(brokerUsdt).plus(polyTurnoverUsdt);

  const monthIncome = periodTransactions
    .filter((t) => !isOpeningBalanceTransaction(t) && (t.type === TransactionType.INCOME || t.type === TransactionType.EXPECTED_MONEY_RECEIVED))
    .reduce((sum, t) => sum.plus(t.currency === "UAH" ? D(t.amount).div(rate) : t.amount), new Decimal(0));
  const monthExpenseUah = periodTransactions
    .filter((t) => t.type === TransactionType.EXPENSE && t.currency === "UAH")
    .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const p2pCount = periodTransactions.filter((t) => t.type === TransactionType.P2P_WITHDRAWAL).length;
  const p2pDepositCount = periodTransactions.filter((t) => t.type === TransactionType.P2P_DEPOSIT).length;
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
    if (transaction.currency === "USDT" || transaction.currency === "USD") {
      incomeSourceUsdtMap.set(label, D(incomeSourceUsdtMap.get(label) || 0).plus(transaction.amount));
      timelinePoint.usdt = timelinePoint.usdt.plus(transaction.amount);
    } else if (transaction.currency === "UAH") {
      incomeSourceUahMap.set(label, D(incomeSourceUahMap.get(label) || 0).plus(transaction.amount));
      timelinePoint.uah = timelinePoint.uah.plus(transaction.amount);
    }
    incomeTimelineMap.set(dateKey, timelinePoint);
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
  const dateFormatter = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" });
  const metadataSource = (metadata: unknown) => {
    const source = metadataObject(metadata)?.source;
    return typeof source === "string" ? source : null;
  };

  // Every result event over ALL time; the page period only slices them, the charts have their own presets.
  // `source` names where it came from, so one list feeds the net result, the tiles and "Що приносить дохід".
  type ResultKind = "income" | "expense" | "flip" | "fx" | "poly";
  const resultEvents: { date: Date; net: Decimal; kind: ResultKind; source: string; workExpense?: boolean }[] = [];
  const addResult = (date: Date, net: Decimal.Value, kind: ResultKind, source: string, workExpense = false) => resultEvents.push({ date, net: D(net), kind, source, workExpense });
  for (const transaction of allTransactions) {
    const source = metadataSource(transaction.metadata);
    if ((transaction.type === TransactionType.INCOME || transaction.type === TransactionType.EXPECTED_MONEY_RECEIVED) && !isOpeningBalanceTransaction(transaction) && !isFlipLedgerTransaction(transaction)) {
      const metadata = metadataObject(transaction.metadata);
      let amount = asUsdt(transaction.amount, transaction.currency);
      if (metadata?.steamType === "ARBITRAGE_COMPLETION") {
        amount = decimalFromMetadata(transaction.metadata, "profit") || amount;
      } else if (metadata?.steamType === "RESALE_WITHDRAWAL") {
        const softwareAmountSpent = decimalFromMetadata(transaction.metadata, "softwareAmountSpent");
        if (softwareAmountSpent) amount = amount.minus(softwareAmountSpent);
      }
      addResult(transaction.transactionDate, amount, "income", transaction.incomeSource?.name || "Без джерела");
    } else if (transaction.type === TransactionType.EXPENSE && !isFlipLedgerTransaction(transaction)) {
      const work = isWorkExpenseTransaction(transaction);
      addResult(transaction.transactionDate, asUsdt(transaction.amount, transaction.currency).negated(), "expense", work ? transaction.incomeSource?.name || "Без напрямку" : "", work);
    } else if (transaction.type === TransactionType.MANUAL_ADJUSTMENT) {
      if (source === "FX_PNL") addResult(transaction.transactionDate, transaction.amount, "fx", "Aurum (Forex)");
      else if (source === "POLY_PNL" || source === "POLY_UNATTRIBUTED") addResult(transaction.transactionDate, transaction.amount, "poly", "Polymarket");
      else if (source === "POLY_RELEASE") {
        const result = polyLocksById.get(String(metadataObject(transaction.metadata)?.polyLockId ?? ""))?.resultPnlUsd;
        if (result != null) addResult(transaction.transactionDate, result, "poly", "Polymarket");
      }
    }
  }
  for (const flip of allFlips) addResult(flip.tradeDate, flip.pnl, "flip", "Фліпи");
  resultEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  const sumResults = (events: typeof resultEvents) => events.reduce((sum, event) => sum.plus(event.net), new Decimal(0));
  const periodResults = resultEvents.filter((event) => inPeriod(event.date));
  const netPnlUsdt = sumResults(resultEvents);
  const periodNetPnlUsdt = sumResults(periodResults);
  const periodGrossUsdt = sumResults(periodResults.filter((event) => event.kind !== "expense"));
  const periodFxUsdt = sumResults(periodResults.filter((event) => event.kind === "fx"));
  const periodPolyUsdt = sumResults(periodResults.filter((event) => event.kind === "poly"));
  const periodSteamUsdt = sumResults(periodResults.filter((event) => /^steam/i.test(event.source)));
  let runningNet = new Decimal(0);
  const pnlTimeline = resultEvents.map((event) => {
    runningNet = runningNet.plus(event.net);
    return { t: event.date.getTime(), delta: event.net.toNumber(), total: runningNet.toNumber() };
  });

  // Where the period's money came from, signed by day: income minus that direction's work costs, flips, Aurum and Polymarket (a day's net, not every trade).
  const sourceDays = new Map<string, { label: string; sources: Map<string, Decimal> }>();
  for (const event of periodResults) {
    if (!event.source) continue;
    const dateKey = event.date.toISOString().slice(0, 10);
    const day = sourceDays.get(dateKey) || { label: dateFormatter.format(event.date), sources: new Map<string, Decimal>() };
    day.sources.set(event.source, D(day.sources.get(event.source) || 0).plus(event.net));
    sourceDays.set(dateKey, day);
  }
  const incomeSourceTimeline = Array.from(sourceDays.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: value.label,
      sources: Array.from(value.sources.entries()).map(([name, amount]) => ({ name, value: amount.toNumber() }))
    }));

  const bankHistory = buildBankHistory({
    now: new Date(),
    rate,
    current: { total: potentialBankUsdt, available: availableBankUsdt, turnover: turnoverUsdt },
    polyPoolId,
    accounts,
    transactions: allTransactions,
    expected: allExpectedMoney.map((item) => ({
      amountUsdt: asUsdt(item.amount, item.currency),
      createdAt: item.createdAt,
      endedAt: item.status === ExpectedMoneyStatus.EXPECTED || item.status === ExpectedMoneyStatus.NEED_TO_COLLECT || item.status === ExpectedMoneyStatus.IN_PROGRESS ? null : item.resolvedAt ?? item.createdAt
    })),
    frozen: frozenFunds.filter((fund) => fund.currency === "USDT").map((fund) => ({ amountUsdt: fund.amount, since: fund.frozenDate })),
    polyLocks: polyLocks.map((lock) => ({ amountUsd: lock.amountUsd, lockedAt: lock.lockedAt, releasedAt: lock.releasedAt, locked: lock.status === "LOCKED" })),
    steamInvestments: steamInvestments.map((item) => ({
      sourceAccountId: item.sourceAccountId,
      externalAmount: item.externalAmount,
      startedAt: item.startedAt,
      endedAt: item.updatedAt,
      active: item.status === "ACTIVE"
    })),
    steamRounds: steamRounds.map((round) => ({
      sourceAccountId: round.sourceAccountId,
      investedAmount: round.investedAmount,
      startedAt: round.startedAt,
      completedAt: round.completedAt,
      completed: round.status === "COMPLETED",
      destinationAccountId: round.destinationAccountId,
      finalAmountReceived: round.finalAmountReceived,
      hasTransaction: Boolean(round.transactionId)
    })),
    steamWithdrawals
  });
  return {
    period: {
      label: period.label,
      rangeLabel: period.rangeLabel,
      key: period.key,
      month: period.month,
      monthKey: period.month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      isCurrentMonth: period.key === "month"
    },
    settings,
    rate: rate.toString(),
    rateSource: source,
    accounts,
    frozenByAccount,
    expectedMoney,
    recentTransactions: recentTransactions.filter((item) => !isOpeningBalanceTransaction(item)).slice(0, 3),
    expenseCategories,
    workExpenseSourcesUsdt,
    incomeSourcesUah,
    incomeSourcesUsdt,
    incomeTimeline,
    incomeSourceTimeline,
    pnlTimeline,
    bankHistory,
    flips: flipStatistics,
    steam: {
      frozenCapital: steamFrozenCapital.toString(),
      profit: steam.totals.steamProfit
    },
    turnover: {
      totalUsdt: turnoverUsdt.toString(),
      steamUsdt: steamFrozenCapital.toString(),
      aurumUsdt: brokerUsdt.toString(),
      polyUsdt: polyTurnoverUsdt.toString()
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
      brokerUsdt: brokerUsdt.toString(),
      polyLockedUsdt: polyLockedUsdt.toString(),
      polyPoolUsdt: polyPoolUsdt.toString(),
      availableBankUsdt: availableBankUsdt.toString(),
      potentialBankUsdt: potentialBankUsdt.toString(),
      monthIncomeUsdt: monthIncome.toString(),
      monthExpenseUah: monthExpenseUah.toString(),
      netPnlUsdt: netPnlUsdt.toString(),
      periodNetPnlUsdt: periodNetPnlUsdt.toString(),
      periodGrossUsdt: periodGrossUsdt.toString(),
      periodFxUsdt: periodFxUsdt.toString(),
      periodPolyUsdt: periodPolyUsdt.toString(),
      periodSteamUsdt: periodSteamUsdt.toString(),
      p2pCount,
      p2pDepositCount,
      cashWithdrawalCount
    }
  };
}
