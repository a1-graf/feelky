import { AccountType, ExpectedMoneyStatus, FrozenFundStatus, RateMode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import { steamAnalytics } from "@/lib/steam";

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

export async function getDashboard(userId: string) {
  const [accounts, frozenFunds, expectedMoney, settings, recentTransactions, expenseTransactions, incomeTransactions, flips] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true }, include: { childAccounts: true }, orderBy: { createdAt: "asc" } }),
    prisma.frozenFund.findMany({ where: { userId, status: FrozenFundStatus.FROZEN } }),
    prisma.expectedMoney.findMany({
      where: { userId, status: { in: [ExpectedMoneyStatus.EXPECTED, ExpectedMoneyStatus.NEED_TO_COLLECT, ExpectedMoneyStatus.IN_PROGRESS] } }
    }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null },
      orderBy: { transactionDate: "desc" },
      take: 8,
      include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: TransactionType.EXPENSE, currency: "UAH" },
      orderBy: { transactionDate: "desc" },
      take: 60,
      include: { category: true }
    }),
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, type: { in: [TransactionType.INCOME, TransactionType.EXPECTED_MONEY_RECEIVED] } },
      orderBy: { transactionDate: "desc" },
      take: 60,
      include: { incomeSource: true }
    }),
    prisma.flip.findMany({
      where: { userId },
      orderBy: { tradeDate: "desc" },
      take: 120
    })
  ]);

  const { rate, source } = await resolveUahUsdtRate(userId);
  const steam = await steamAnalytics.dashboard(userId);
  const frozenByAccount = new Map<string, Decimal>();
  for (const frozen of frozenFunds) {
    frozenByAccount.set(frozen.accountId, D(frozenByAccount.get(frozen.accountId) || 0).plus(frozen.amount));
  }

  const cryptoTypes: AccountType[] = [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET];
  const cryptoAccounts = accounts.filter((account) => cryptoTypes.includes(account.type));
  const bankCards = accounts.filter((account) => account.type === AccountType.BANK_CARD);
  const cashAccounts = accounts.filter((account) => account.type === AccountType.CASH);

  const cryptoTotal = cryptoAccounts.reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const frozenCrypto = frozenFunds.filter((fund) => fund.currency === "USDT").reduce((sum, fund) => sum.plus(fund.amount), new Decimal(0));
  const availableCrypto = cryptoTotal.minus(frozenCrypto);
  const cardUah = bankCards.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUah = cashAccounts.filter((account) => account.currency === "UAH").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const cashUsd = cashAccounts.filter((account) => account.currency === "USD").reduce((sum, account) => sum.plus(account.currentBalance), new Decimal(0));
  const uahAsUsdt = cardUah.plus(cashUah).div(rate);
  const cashUsdAsUsdt = cashUsd;
  const availableBankUsdt = availableCrypto.plus(uahAsUsdt).plus(cashUsdAsUsdt);
  const potentialExpected = expectedMoney.reduce((sum, item) => {
    if (item.currency === "UAH") return sum.plus(D(item.amount).div(rate));
    return sum.plus(item.amount);
  }, new Decimal(0));
  const steamFrozenCapital = D(steam.totals.frozenCapital);
  const potentialBankUsdt = availableBankUsdt.plus(frozenCrypto).plus(potentialExpected).plus(steamFrozenCapital);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyTransactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: null, transactionDate: { gte: monthStart } }
  });
  const monthIncome = monthlyTransactions
    .filter((t) => t.type === TransactionType.INCOME || t.type === TransactionType.EXPECTED_MONEY_RECEIVED)
    .reduce((sum, t) => sum.plus(t.currency === "UAH" ? D(t.amount).div(rate) : t.amount), new Decimal(0));
  const monthExpenseUah = monthlyTransactions
    .filter((t) => t.type === TransactionType.EXPENSE && t.currency === "UAH")
    .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const p2pCount = monthlyTransactions.filter((t) => t.type === TransactionType.P2P_WITHDRAWAL).length;
  const cashWithdrawalCount = monthlyTransactions.filter((t) => t.type === TransactionType.CASH_WITHDRAWAL).length;
  const monthlyFlips = flips.filter((flip) => flip.tradeDate >= monthStart);
  const flipTotalPnl = flips.reduce((sum, flip) => sum.plus(flip.pnl), new Decimal(0));
  const flipMonthPnl = monthlyFlips.reduce((sum, flip) => sum.plus(flip.pnl), new Decimal(0));
  const flipWins = flips.filter((flip) => D(flip.pnl).gt(0)).length;
  const flipLosses = flips.filter((flip) => D(flip.pnl).lt(0)).length;
  const flipClosed = flipWins + flipLosses;
  const flipSetupMap = new Map<string, { pnl: Decimal; count: number; wins: number; losses: number }>();
  for (const flip of flips) {
    const current = flipSetupMap.get(flip.setup) || { pnl: new Decimal(0), count: 0, wins: 0, losses: 0 };
    const pnl = D(flip.pnl);
    current.pnl = current.pnl.plus(pnl);
    current.count += 1;
    if (pnl.gt(0)) current.wins += 1;
    if (pnl.lt(0)) current.losses += 1;
    flipSetupMap.set(flip.setup, current);
  }
  const flipSetups = Array.from(flipSetupMap.entries())
    .map(([setup, value]) => ({
      setup,
      pnl: value.pnl.toString(),
      count: value.count,
      wins: value.wins,
      losses: value.losses,
      winRate: value.wins + value.losses ? Math.round((value.wins / (value.wins + value.losses)) * 100) : 0
    }))
    .sort((a, b) => Number(b.pnl) - Number(a.pnl));
  const expenseCategoryMap = new Map<string, Decimal>();
  for (const transaction of expenseTransactions) {
    const label = transaction.category?.name || "Без категорії";
    expenseCategoryMap.set(label, D(expenseCategoryMap.get(label) || 0).plus(transaction.amount));
  }
  const expenseCategories = Array.from(expenseCategoryMap.entries())
    .map(([name, value]) => ({ name, value: value.toString() }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const incomeSourceUahMap = new Map<string, Decimal>();
  const incomeSourceUsdtMap = new Map<string, Decimal>();
  const incomeTimelineMap = new Map<string, { label: string; usdt: Decimal; uah: Decimal }>();
  for (const transaction of incomeTransactions) {
    const label = transaction.incomeSource?.name || "\u0411\u0435\u0437 \u0434\u0436\u0435\u0440\u0435\u043b\u0430";
    const dateKey = transaction.transactionDate.toISOString().slice(0, 10);
    const timelinePoint =
      incomeTimelineMap.get(dateKey) ||
      {
        label: new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(transaction.transactionDate),
        usdt: new Decimal(0),
        uah: new Decimal(0)
      };
    if (transaction.currency === "USDT") {
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
  return {
    settings,
    rate: rate.toString(),
    rateSource: source,
    accounts,
    frozenByAccount,
    expectedMoney,
    recentTransactions,
    expenseCategories,
    incomeSourcesUah,
    incomeSourcesUsdt,
    incomeTimeline,
    flips: {
      totalPnl: flipTotalPnl.toString(),
      monthPnl: flipMonthPnl.toString(),
      count: flips.length,
      wins: flipWins,
      losses: flipLosses,
      winRate: flipClosed ? Math.round((flipWins / flipClosed) * 100) : 0,
      setups: flipSetups,
      recent: flips.slice(0, 8).map((flip) => ({
        id: flip.id,
        setup: flip.setup,
        pnl: flip.pnl.toString(),
        tradeDate: flip.tradeDate.toISOString(),
        note: flip.note
      }))
    },
    steam: {
      frozenCapital: steamFrozenCapital.toString(),
      profit: steam.totals.steamProfit
    },
    totals: {
      cryptoTotal: cryptoTotal.toString(),
      availableCrypto: availableCrypto.toString(),
      frozenCrypto: frozenCrypto.toString(),
      cardUah: cardUah.toString(),
      cashUah: cashUah.toString(),
      cashUsd: cashUsd.toString(),
      availableBankUsdt: availableBankUsdt.toString(),
      potentialBankUsdt: potentialBankUsdt.toString(),
      monthIncomeUsdt: monthIncome.toString(),
      monthExpenseUah: monthExpenseUah.toString(),
      p2pCount,
      cashWithdrawalCount
    }
  };
}
