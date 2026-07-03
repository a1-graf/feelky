import {
  AccountType,
  Prisma,
  SteamArbitrageResidualStatus,
  SteamArbitrageRoundStatus,
  SteamResaleInvestmentStatus,
  TransactionType
} from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { allocationIsValid, percent, withdrawalLoss } from "@/lib/steam-calculations";
import { D, roundCurrency } from "@/lib/money";

type Tx = Prisma.TransactionClient;

function pct(part: Decimal.Value, whole: Decimal.Value) {
  return percent(part, whole);
}

function daysBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export class SteamResaleService {
  constructor(private readonly db = prisma) {}

  async createAccount(userId: string, input: { name: string; note?: string | null; currentSoftwareBalance?: Decimal.Value }) {
    return this.db.steamResaleAccount.create({
      data: {
        userId,
        name: input.name,
        note: input.note,
        currentSoftwareBalance: roundCurrency(input.currentSoftwareBalance || 0, "USDT").toString()
      }
    });
  }

  async createInvestment(userId: string, input: {
    resaleAccountId: string;
    sourceAccountId: string;
    externalAmount: Decimal.Value;
    receivedSteamAmount: Decimal.Value;
    startedAt: Date;
    completedAt?: Date | null;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const resaleAccount = await this.requireResaleAccount(tx, userId, input.resaleAccountId);
      const source = await this.requireAccount(tx, userId, input.sourceAccountId);
      if (source.currency !== "USDT") throw new Error("Steam investments must use a USDT source account");
      const externalAmount = roundCurrency(input.externalAmount, "USDT");
      const receivedSteamAmount = roundCurrency(input.receivedSteamAmount, "USDT");
      await this.adjustAccount(tx, userId, source.id, externalAmount.negated(), false);
      const investment = await tx.steamResaleInvestment.create({
        data: {
          userId,
          resaleAccountId: resaleAccount.id,
          sourceAccountId: source.id,
          externalAmount: externalAmount.toString(),
          receivedSteamAmount: receivedSteamAmount.toString(),
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          note: input.note
        }
      });
      await this.audit(tx, userId, "SteamResaleInvestment", investment.id, "CREATE", null, investment);
      return investment;
    });
  }

  async createSnapshot(userId: string, input: { resaleAccountId: string; balance: Decimal.Value; snapshotDate: Date; note?: string | null }) {
    return this.db.$transaction(async (tx) => {
      const account = await this.requireResaleAccount(tx, userId, input.resaleAccountId);
      const balance = roundCurrency(input.balance, "USDT");
      const existing = await tx.steamResaleBalanceSnapshot.findUnique({
        where: { resaleAccountId_snapshotDate: { resaleAccountId: account.id, snapshotDate: input.snapshotDate } }
      });
      if (existing) throw new Error("Snapshot for this account and date already exists");
      const snapshot = await tx.steamResaleBalanceSnapshot.create({
        data: {
          userId,
          resaleAccountId: account.id,
          balance: balance.toString(),
          snapshotDate: input.snapshotDate,
          note: input.note
        }
      });
      const updated = await tx.steamResaleAccount.update({
        where: { id: account.id },
        data: { currentSoftwareBalance: balance.toString() }
      });
      await this.audit(tx, userId, "SteamResaleBalanceSnapshot", snapshot.id, "CREATE", null, snapshot);
      await this.audit(tx, userId, "SteamResaleAccount", account.id, "SOFTWARE_BALANCE_UPDATE", account, updated);
      return snapshot;
    });
  }

  async createWithdrawal(userId: string, input: {
    resaleAccountId: string;
    destinationAccountId: string;
    softwareAmountSpent: Decimal.Value;
    amountReceived: Decimal.Value;
    withdrawalDate: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const resaleAccount = await this.requireResaleAccount(tx, userId, input.resaleAccountId);
      const destination = await this.requireAccount(tx, userId, input.destinationAccountId);
      if (destination.currency !== "USDT") throw new Error("Steam resale withdrawals must arrive to a USDT account");
      const softwareAmountSpent = roundCurrency(input.softwareAmountSpent, "USDT");
      const amountReceived = roundCurrency(input.amountReceived, "USDT");
      if (D(resaleAccount.currentSoftwareBalance).lt(softwareAmountSpent)) throw new Error("Not enough software balance");
      const updatedAccount = await tx.steamResaleAccount.update({
        where: { id: resaleAccount.id },
        data: { currentSoftwareBalance: D(resaleAccount.currentSoftwareBalance).minus(softwareAmountSpent).toString() }
      });
      await this.adjustAccount(tx, userId, destination.id, amountReceived, false);
      const incomeSource = await this.ensureIncomeSource(tx, userId, "Steam");
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.INCOME,
          amount: amountReceived.toString(),
          currency: "USDT",
          destinationAccountId: destination.id,
          incomeSourceId: incomeSource.id,
          note: input.note || "Steam resale withdrawal",
          transactionDate: input.withdrawalDate,
          metadata: {
            steamType: "RESALE_WITHDRAWAL",
            softwareAmountSpent: softwareAmountSpent.toString(),
            withdrawalLoss: withdrawalLoss(softwareAmountSpent, amountReceived).toString(),
            withdrawalLossPercent: pct(withdrawalLoss(softwareAmountSpent, amountReceived), softwareAmountSpent).toString()
          }
        }
      });
      const withdrawal = await tx.steamResaleWithdrawal.create({
        data: {
          userId,
          resaleAccountId: resaleAccount.id,
          destinationAccountId: destination.id,
          transactionId: transaction.id,
          softwareAmountSpent: softwareAmountSpent.toString(),
          amountReceived: amountReceived.toString(),
          withdrawalDate: input.withdrawalDate,
          note: input.note
        }
      });
      await this.audit(tx, userId, "SteamResaleAccount", resaleAccount.id, "SOFTWARE_BALANCE_DEBIT", resaleAccount, updatedAccount);
      await this.audit(tx, userId, "SteamResaleWithdrawal", withdrawal.id, "CREATE", null, withdrawal);
      return withdrawal;
    });
  }

  private async requireResaleAccount(tx: Tx, userId: string, id: string) {
    const account = await tx.steamResaleAccount.findFirst({ where: { id, userId, archivedAt: null, isActive: true } });
    if (!account) throw new Error("Steam resale account not found");
    return account;
  }

  private async requireAccount(tx: Tx, userId: string, id: string) {
    const account = await tx.account.findFirst({ where: { id, userId, isActive: true } });
    if (!account) throw new Error("Account not found");
    return account;
  }

  private async adjustAccount(tx: Tx, userId: string, accountId: string, delta: Decimal.Value, allowNegative: boolean) {
    const account = await this.requireAccount(tx, userId, accountId);
    const next = D(account.currentBalance).plus(delta);
    if (!allowNegative && next.lt(0)) throw new Error(`Insufficient funds on ${account.name}`);
    return tx.account.update({ where: { id: accountId }, data: { currentBalance: next.toString() } });
  }

  private async ensureIncomeSource(tx: Tx, userId: string, name: string) {
    const existing = await tx.incomeSource.findUnique({ where: { userId_name: { userId, name } } });
    return existing || tx.incomeSource.create({ data: { userId, name } });
  }

  private async audit(tx: Tx, userId: string, entityType: string, entityId: string, action: string, oldData: unknown, newData: unknown) {
    await tx.auditLog.create({
      data: { userId, entityType, entityId, action, oldData: oldData as Prisma.InputJsonValue, newData: newData as Prisma.InputJsonValue }
    });
  }
}

export class SteamArbitrageService {
  constructor(private readonly db = prisma) {}

  async ensureDefaultSchemes(userId: string) {
    const names = ["Сайт → Steam → TM", "Сайт → TM", "Buff → TM"];
    return Promise.all(names.map((name) => this.db.steamArbitrageScheme.upsert({
      where: { userId_name: { userId, name } },
      update: { isActive: true },
      create: { userId, name }
    })));
  }

  async createScheme(userId: string, input: { name: string }) {
    return this.db.steamArbitrageScheme.create({ data: { userId, name: input.name } });
  }

  async createRound(userId: string, input: {
    schemeId: string;
    siteName?: string | null;
    sourceAccountId: string;
    investedAmount: Decimal.Value;
    startedAt: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const scheme = await tx.steamArbitrageScheme.findFirst({ where: { id: input.schemeId, userId, archivedAt: null, isActive: true } });
      if (!scheme) throw new Error("Steam arbitrage scheme not found");
      const source = await this.requireAccount(tx, userId, input.sourceAccountId);
      if (source.currency !== "USDT") throw new Error("Steam arbitrage rounds must use a USDT source account");
      const investedAmount = roundCurrency(input.investedAmount, "USDT");
      await this.adjustAccount(tx, userId, source.id, investedAmount.negated(), false);
      const round = await tx.steamArbitrageRound.create({
        data: {
          userId,
          schemeId: scheme.id,
          siteName: input.siteName,
          sourceAccountId: source.id,
          investedAmount: investedAmount.toString(),
          startedAt: input.startedAt,
          note: input.note
        }
      });
      await this.audit(tx, userId, "SteamArbitrageRound", round.id, "CREATE", null, round);
      return round;
    });
  }

  async completeRound(userId: string, input: {
    roundId: string;
    destinationAccountId: string;
    finalAmountReceived: Decimal.Value;
    remainingAmount?: Decimal.Value;
    completedAt: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const round = await tx.steamArbitrageRound.findFirst({ where: { id: input.roundId, userId, status: SteamArbitrageRoundStatus.ACTIVE, archivedAt: null } });
      if (!round) throw new Error("Active Steam arbitrage round not found");
      const destination = await this.requireAccount(tx, userId, input.destinationAccountId);
      if (destination.currency !== "USDT") throw new Error("Steam arbitrage completion must arrive to a USDT account");
      const finalAmountReceived = roundCurrency(input.finalAmountReceived, "USDT");
      const remainingAmount = roundCurrency(input.remainingAmount || 0, "USDT");
      await this.adjustAccount(tx, userId, destination.id, finalAmountReceived, false);
      const incomeSource = await this.ensureIncomeSource(tx, userId, "Steam");
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.INCOME,
          amount: finalAmountReceived.toString(),
          currency: "USDT",
          destinationAccountId: destination.id,
          incomeSourceId: incomeSource.id,
          note: input.note || "Steam arbitrage completion",
          transactionDate: input.completedAt,
          metadata: {
            steamType: "ARBITRAGE_COMPLETION",
            roundId: round.id,
            investedAmount: round.investedAmount.toString(),
            profit: finalAmountReceived.minus(round.investedAmount).toString(),
            roi: pct(finalAmountReceived.minus(round.investedAmount), round.investedAmount).toString()
          }
        }
      });
      const updatedRound = await tx.steamArbitrageRound.update({
        where: { id: round.id },
        data: {
          destinationAccountId: destination.id,
          transactionId: transaction.id,
          finalAmountReceived: finalAmountReceived.toString(),
          remainingAmount: remainingAmount.toString(),
          completedAt: input.completedAt,
          status: SteamArbitrageRoundStatus.COMPLETED,
          note: input.note ?? round.note
        }
      });
      if (remainingAmount.gt(0)) {
        await tx.steamArbitrageResidual.create({
          data: { userId, roundId: round.id, amount: remainingAmount.toString(), note: input.note }
        });
      }
      await this.audit(tx, userId, "SteamArbitrageRound", round.id, "COMPLETE", round, updatedRound);
      return updatedRound;
    });
  }

  async resolveResidual(userId: string, input: {
    residualId: string;
    status: SteamArbitrageResidualStatus;
    destinationAccountId?: string | null;
    resolvedAmount?: Decimal.Value;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const residual = await tx.steamArbitrageResidual.findFirst({ where: { id: input.residualId, userId, status: SteamArbitrageResidualStatus.OPEN } });
      if (!residual) throw new Error("Open Steam residual not found");
      let destinationAccountId = input.destinationAccountId || null;
      let resolvedAmount = input.resolvedAmount ? roundCurrency(input.resolvedAmount, "USDT") : new Decimal(0);
      if (input.status === SteamArbitrageResidualStatus.WITHDRAWN) {
        if (!destinationAccountId) throw new Error("Destination account is required for residual withdrawal");
        const account = await this.requireAccount(tx, userId, destinationAccountId);
        if (account.currency !== "USDT") throw new Error("Residual withdrawal must arrive to a USDT account");
        await this.adjustAccount(tx, userId, account.id, resolvedAmount, false);
      } else {
        destinationAccountId = null;
        resolvedAmount = new Decimal(0);
      }
      const updated = await tx.steamArbitrageResidual.update({
        where: { id: residual.id },
        data: {
          status: input.status,
          destinationAccountId,
          resolvedAmount: input.status === SteamArbitrageResidualStatus.WITHDRAWN ? resolvedAmount.toString() : null,
          resolvedAt: new Date(),
          note: input.note ?? residual.note
        }
      });
      await this.audit(tx, userId, "SteamArbitrageResidual", residual.id, input.status, residual, updated);
      return updated;
    });
  }

  private async requireAccount(tx: Tx, userId: string, id: string) {
    const account = await tx.account.findFirst({ where: { id, userId, isActive: true } });
    if (!account) throw new Error("Account not found");
    return account;
  }

  private async adjustAccount(tx: Tx, userId: string, accountId: string, delta: Decimal.Value, allowNegative: boolean) {
    const account = await this.requireAccount(tx, userId, accountId);
    const next = D(account.currentBalance).plus(delta);
    if (!allowNegative && next.lt(0)) throw new Error(`Insufficient funds on ${account.name}`);
    return tx.account.update({ where: { id: accountId }, data: { currentBalance: next.toString() } });
  }

  private async ensureIncomeSource(tx: Tx, userId: string, name: string) {
    const existing = await tx.incomeSource.findUnique({ where: { userId_name: { userId, name } } });
    return existing || tx.incomeSource.create({ data: { userId, name } });
  }

  private async audit(tx: Tx, userId: string, entityType: string, entityId: string, action: string, oldData: unknown, newData: unknown) {
    await tx.auditLog.create({
      data: { userId, entityType, entityId, action, oldData: oldData as Prisma.InputJsonValue, newData: newData as Prisma.InputJsonValue }
    });
  }
}

export class SteamExpenseService {
  constructor(private readonly db = prisma) {}

  async createExpense(userId: string, input: {
    sourceAccountId: string;
    amount: Decimal.Value;
    transactionDate: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const source = await tx.account.findFirst({ where: { id: input.sourceAccountId, userId, isActive: true } });
      if (!source) throw new Error("Steam expense source account not found");
      if (source.currency !== "USDT") throw new Error("Steam expenses must be paid in USDT");
      const amount = roundCurrency(input.amount, "USDT");
      const nextBalance = D(source.currentBalance).minus(amount);
      const category = await tx.category.findUnique({ where: { userId_name: { userId, name: "Steam" } } })
        || await tx.category.create({ data: { userId, name: "Steam" } });
      await tx.account.update({ where: { id: source.id }, data: { currentBalance: nextBalance.toString() } });
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EXPENSE,
          amount: amount.toString(),
          currency: "USDT",
          sourceAccountId: source.id,
          categoryId: category.id,
          note: input.note,
          transactionDate: input.transactionDate,
          metadata: { steamExpense: true }
        }
      });
    });
  }

  async allocateExpense(userId: string, input: {
    expenseTransactionId: string;
    resalePercent: Decimal.Value;
    arbitragePercent: Decimal.Value;
    arbitrageRoundId?: string | null;
  }) {
    const resalePercent = D(input.resalePercent);
    const arbitragePercent = D(input.arbitragePercent);
    if (!allocationIsValid(resalePercent, arbitragePercent)) throw new Error("Steam expense allocation must total 100%");
    const transaction = await this.db.transaction.findFirst({ where: { id: input.expenseTransactionId, userId, type: TransactionType.EXPENSE, currency: "USDT", archivedAt: null } });
    if (!transaction) throw new Error("Expense transaction not found");
    if (input.arbitrageRoundId) {
      const round = await this.db.steamArbitrageRound.findFirst({ where: { id: input.arbitrageRoundId, userId } });
      if (!round) throw new Error("Steam arbitrage round not found");
    }
    return this.db.steamExpenseAllocation.upsert({
      where: { expenseTransactionId: transaction.id },
      update: {
        resalePercent: resalePercent.toString(),
        arbitragePercent: arbitragePercent.toString(),
        arbitrageRoundId: input.arbitrageRoundId || null
      },
      create: {
        userId,
        expenseTransactionId: transaction.id,
        resalePercent: resalePercent.toString(),
        arbitragePercent: arbitragePercent.toString(),
        arbitrageRoundId: input.arbitrageRoundId || null
      }
    });
  }
}

export class SteamAnalyticsService {
  constructor(private readonly db = prisma) {}

  async dashboard(userId: string, period: { from?: Date; to?: Date } = {}) {
    const [resaleAccounts, resaleInvestments, resaleWithdrawals, schemes, rounds, residuals, expenseAllocations, accounts] = await Promise.all([
      this.db.steamResaleAccount.findMany({ where: { userId, archivedAt: null, isActive: true }, orderBy: { createdAt: "asc" } }),
      this.db.steamResaleInvestment.findMany({ where: { userId, archivedAt: null } }),
      this.db.steamResaleWithdrawal.findMany({ where: { userId, archivedAt: null, ...(period.from || period.to ? { withdrawalDate: { gte: period.from, lte: period.to } } : {}) } }),
      this.db.steamArbitrageScheme.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } }),
      this.db.steamArbitrageRound.findMany({ where: { userId, archivedAt: null }, include: { scheme: true } }),
      this.db.steamArbitrageResidual.findMany({ where: { userId } }),
      this.db.steamExpenseAllocation.findMany({
        where: { userId },
        include: { expenseTransaction: true, arbitrageRound: true }
      }),
      this.db.account.findMany({
        where: { userId, isActive: true, currency: "USDT", type: { in: [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET] } },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const activeResaleInvestments = resaleInvestments.filter((item) => item.status === SteamResaleInvestmentStatus.ACTIVE && !item.archivedAt);
    const activeRounds = rounds.filter((item) => item.status === SteamArbitrageRoundStatus.ACTIVE && !item.archivedAt);
    const completedRounds = rounds.filter((item) => item.status === SteamArbitrageRoundStatus.COMPLETED && !item.archivedAt);
    const openResiduals = residuals.filter((item) => item.status === SteamArbitrageResidualStatus.OPEN);
    const withdrawnResiduals = residuals.filter((item) => item.status === SteamArbitrageResidualStatus.WITHDRAWN);
    const inPeriod = (date?: Date | null) => {
      if (!date) return false;
      if (period.from && date < period.from) return false;
      if (period.to && date > period.to) return false;
      return true;
    };

    const expenseRows = expenseAllocations.filter((item) => !item.expenseTransaction.archivedAt && inPeriod(item.expenseTransaction.transactionDate));
    const resaleExpenses = expenseRows.reduce((sum, item) => sum.plus(D(item.expenseTransaction.amount).mul(item.resalePercent).div(100)), new Decimal(0));
    const arbitrageUnboundExpenses = expenseRows
      .filter((item) => !item.arbitrageRoundId)
      .reduce((sum, item) => sum.plus(D(item.expenseTransaction.amount).mul(item.arbitragePercent).div(100)), new Decimal(0));
    const roundExpenseMap = new Map<string, Decimal>();
    for (const item of expenseRows.filter((row) => row.arbitrageRoundId)) {
      roundExpenseMap.set(item.arbitrageRoundId!, D(roundExpenseMap.get(item.arbitrageRoundId!) || 0).plus(D(item.expenseTransaction.amount).mul(item.arbitragePercent).div(100)));
    }

    const resaleWithdrawn = resaleWithdrawals.reduce((sum, item) => sum.plus(item.amountReceived), new Decimal(0));
    const resaleProfit = resaleWithdrawn.minus(resaleExpenses);
    const completedProfit = completedRounds
      .filter((round) => inPeriod(round.completedAt))
      .reduce((sum, round) => sum.plus(D(round.finalAmountReceived || 0).minus(round.investedAmount).minus(roundExpenseMap.get(round.id) || 0)), new Decimal(0));
    const residualProfit = withdrawnResiduals
      .filter((residual) => inPeriod(residual.resolvedAt))
      .reduce((sum, residual) => sum.plus(residual.resolvedAmount || 0), new Decimal(0));
    const arbitrageProfit = completedProfit.plus(residualProfit).minus(arbitrageUnboundExpenses);
    const activeResaleCapital = activeResaleInvestments.reduce((sum, item) => sum.plus(item.externalAmount), new Decimal(0));
    const activeArbitrageCapital = activeRounds.reduce((sum, item) => sum.plus(item.investedAmount), new Decimal(0));
    const openResidualCapital = openResiduals.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
    const frozenCapital = activeResaleCapital.plus(activeArbitrageCapital).plus(openResidualCapital);
    const softwareBalance = resaleAccounts.reduce((sum, item) => sum.plus(item.currentSoftwareBalance), new Decimal(0));
    const withdrawnClean = resaleWithdrawn.plus(completedRounds.reduce((sum, item) => sum.plus(item.finalAmountReceived || 0), new Decimal(0)));
    const completedWithProfit = completedRounds.filter((round) => D(round.investedAmount).gt(0) && round.finalAmountReceived && inPeriod(round.completedAt));
    const roiRows = completedWithProfit.map((round) => pct(D(round.finalAmountReceived || 0).minus(round.investedAmount).minus(roundExpenseMap.get(round.id) || 0), round.investedAmount));
    const avgRoi = roiRows.length ? roiRows.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(roiRows.length) : new Decimal(0);
    const durations = completedWithProfit.map((round) => daysBetween(round.startedAt, round.completedAt)).filter(Boolean);
    const avgDurationDays = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;

    return {
      accounts,
      resaleAccounts,
      resaleInvestments,
      resaleWithdrawals,
      schemes,
      rounds,
      residuals,
      totals: {
        externalInvestedAllTime: resaleInvestments.reduce((sum, item) => sum.plus(item.externalAmount), new Decimal(0)).plus(rounds.reduce((sum, item) => sum.plus(item.investedAmount), new Decimal(0))).toString(),
        activeResaleCapital: activeResaleCapital.toString(),
        activeArbitrageCapital: activeArbitrageCapital.toString(),
        openResidualCapital: openResidualCapital.toString(),
        frozenCapital: frozenCapital.toString(),
        softwareBalance: softwareBalance.toString(),
        withdrawnClean: withdrawnClean.toString(),
        resaleProfit: resaleProfit.toString(),
        arbitrageProfit: arbitrageProfit.toString(),
        steamProfit: resaleProfit.plus(arbitrageProfit).toString(),
        steamExpenses: resaleExpenses.plus(arbitrageUnboundExpenses).plus(Array.from(roundExpenseMap.values()).reduce((sum, value) => sum.plus(value), new Decimal(0))).toString(),
        activeRounds: activeRounds.length,
        completedRounds: completedRounds.length,
        avgRoi: avgRoi.toString(),
        avgDurationDays: avgDurationDays.toFixed(1)
      }
    };
  }

  async potentialSteamCapital(userId: string) {
    const data = await this.dashboard(userId);
    return D(data.totals.frozenCapital);
  }
}

export const steamResale = new SteamResaleService();
export const steamArbitrage = new SteamArbitrageService();
export const steamExpense = new SteamExpenseService();
export const steamAnalytics = new SteamAnalyticsService();
