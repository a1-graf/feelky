import { AccountType, ExpectedMoneyStatus, FrozenFundStatus, Prisma, TransactionType } from "@prisma/client";
import type { Currency } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { calculateSpentUsdt, D, roundCurrency, toPrismaDecimal } from "@/lib/money";
import { OPENING_BALANCE_DATE } from "@/lib/transaction-utils";
import { MAIN_WALLET_NAME } from "@/lib/user-defaults";

type Tx = Prisma.TransactionClient;
type CurrencyCode = "UAH" | "USDT" | "USD";

export class LedgerService {
  constructor(private readonly db = prisma) {}

  async createAccount(userId: string, input: {
    type: AccountType;
    name: string;
    currency: Currency;
    initialBalance?: Decimal.Value;
    provider?: string | null;
    note?: string | null;
    parentAccountId?: string | null;
  }) {
    const initial = D(input.initialBalance || 0);
    return this.db.account.create({
      data: {
        userId,
        type: input.type,
        name: input.name,
        provider: input.provider,
        currency: input.currency,
        initialBalance: initial.toString(),
        currentBalance: initial.toString(),
        note: input.note,
        parentAccountId: input.parentAccountId
      }
    });
  }

  async createIncome(userId: string, input: {
    amount: Decimal.Value;
    currency: Currency;
    transactionDate: Date;
    incomeSourceId: string;
    destinationAccountId: string;
    note?: string | null;
    type?: TransactionType;
    isOpeningBalance?: boolean;
  }) {
    return this.db.$transaction(async (tx) => {
      const amount = roundCurrency(input.amount, input.currency as CurrencyCode);
      const destinationAccount = await this.requireAccount(tx, userId, input.destinationAccountId);
      if (destinationAccount.currency !== input.currency) {
        throw new Error(`Income currency ${input.currency} does not match ${destinationAccount.name} ${destinationAccount.currency}`);
      }
      await this.adjustAccount(tx, userId, input.destinationAccountId, amount, false);
      return tx.transaction.create({
        data: {
          userId,
          type: input.type || TransactionType.INCOME,
          amount: amount.toString(),
          currency: input.currency,
          destinationAccountId: input.destinationAccountId,
          incomeSourceId: input.incomeSourceId,
          note: input.note,
          transactionDate: input.isOpeningBalance ? OPENING_BALANCE_DATE : input.transactionDate,
          metadata: input.isOpeningBalance ? { isOpeningBalance: true } : undefined
        }
      });
    });
  }

  async createExpense(userId: string, input: {
    amount: Decimal.Value;
    currency: Currency;
    transactionDate: Date;
    categoryId: string;
    sourceAccountId: string;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const sourceAccount = await this.requireAccount(tx, userId, input.sourceAccountId);
      if (sourceAccount.currency !== input.currency) {
        throw new Error(`Expense currency ${input.currency} does not match ${sourceAccount.name} ${sourceAccount.currency}`);
      }
      const amount = roundCurrency(input.amount, input.currency as CurrencyCode);
      await this.adjustAccount(tx, userId, input.sourceAccountId, amount.negated(), false);
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EXPENSE,
          amount: amount.toString(),
          currency: input.currency,
          sourceAccountId: input.sourceAccountId,
          categoryId: input.categoryId,
          note: input.note,
          transactionDate: input.transactionDate
        }
      });
    });
  }

  async createP2PWithdrawal(userId: string, input: {
    receivedUah: Decimal.Value;
    rateUahPerUsdt: Decimal.Value;
    transactionDate: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const settings = await this.getSettings(tx, userId);
      const sourceAccountId = settings.p2pSourceAccountId || await this.findNamedAccount(tx, userId, MAIN_WALLET_NAME, "USDT");
      const destinationAccountId = settings.p2pDestinationAccountId || await this.findFirstAccount(tx, userId, AccountType.BANK_CARD, "UAH");
      const receivedUah = roundCurrency(input.receivedUah, "UAH");
      const spentUsdt = calculateSpentUsdt(receivedUah, input.rateUahPerUsdt);
      await this.adjustAccount(tx, userId, sourceAccountId, spentUsdt.negated(), false);
      await this.adjustAccount(tx, userId, destinationAccountId, receivedUah, false);
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.P2P_WITHDRAWAL,
          amount: spentUsdt.toString(),
          currency: "USDT",
          convertedAmount: receivedUah.toString(),
          convertedCurrency: "UAH",
          exchangeRate: D(input.rateUahPerUsdt).toString(),
          sourceAccountId,
          destinationAccountId,
          note: input.note,
          transactionDate: input.transactionDate,
          metadata: {
            receivedAmount: receivedUah.toString(),
            receivedCurrency: "UAH",
            spentUsdt: spentUsdt.toString(),
            rate: D(input.rateUahPerUsdt).toString()
          }
        }
      });
    });
  }

  async createCashWithdrawal(userId: string, input: {
    receivedAmount: Decimal.Value;
    receivedCurrency: "UAH" | "USD";
    rate: Decimal.Value;
    transactionDate: Date;
    exchangePlace?: string;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const settings = await this.getSettings(tx, userId);
      const sourceAccountId = settings.p2pSourceAccountId || await this.findNamedAccount(tx, userId, MAIN_WALLET_NAME, "USDT");
      const cashAccountId = await this.findFirstAccount(tx, userId, AccountType.CASH, input.receivedCurrency);
      const receivedAmount = roundCurrency(input.receivedAmount, input.receivedCurrency as CurrencyCode);
      const spentUsdt = calculateSpentUsdt(receivedAmount, input.rate);
      await this.adjustAccount(tx, userId, sourceAccountId, spentUsdt.negated(), false);
      await this.adjustAccount(tx, userId, cashAccountId, receivedAmount, false);
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.CASH_WITHDRAWAL,
          amount: spentUsdt.toString(),
          currency: "USDT",
          convertedAmount: receivedAmount.toString(),
          convertedCurrency: input.receivedCurrency,
          exchangeRate: D(input.rate).toString(),
          sourceAccountId,
          destinationAccountId: cashAccountId,
          note: input.note,
          transactionDate: input.transactionDate,
          metadata: {
            receivedAmount: receivedAmount.toString(),
            receivedCurrency: input.receivedCurrency,
            spentUsdt: spentUsdt.toString(),
            rate: D(input.rate).toString(),
            exchangePlace: input.exchangePlace || settings.cashExchangePlace
          }
        }
      });
    });
  }

  async createManualAdjustment(userId: string, input: {
    accountId: string;
    newBalance: Decimal.Value;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const account = await this.requireAccount(tx, userId, input.accountId);
      const previous = D(account.currentBalance);
      const next = roundCurrency(input.newBalance, account.currency as CurrencyCode);
      const difference = next.minus(previous);
      await this.adjustAccount(tx, userId, input.accountId, difference, true);
      await tx.balanceHistory.create({
        data: {
          userId,
          accountId: input.accountId,
          previousBalance: previous.toString(),
          newBalance: next.toString(),
          difference: difference.toString(),
          note: input.note
        }
      });
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.MANUAL_ADJUSTMENT,
          amount: difference.toString(),
          currency: account.currency,
          destinationAccountId: input.accountId,
          note: input.note,
          transactionDate: new Date(),
          metadata: { previousBalance: previous.toString(), newBalance: next.toString() }
        }
      });
    });
  }

  async createExpectedMoney(userId: string, input: {
    title: string;
    amount: Decimal.Value;
    currency: Currency;
    status?: ExpectedMoneyStatus;
    note?: string | null;
    expectedDate?: Date | null;
  }) {
    return this.db.expectedMoney.create({
      data: {
        userId,
        title: input.title,
        amount: toPrismaDecimal(input.amount, input.currency as CurrencyCode),
        currency: input.currency,
        status: input.status || ExpectedMoneyStatus.EXPECTED,
        note: input.note,
        expectedDate: input.expectedDate
      }
    });
  }

  async receiveExpectedMoney(userId: string, input: {
    expectedMoneyId: string;
    actualAmount: Decimal.Value;
    destinationAccountId: string;
    incomeSourceId: string;
    transactionDate?: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const expected = await tx.expectedMoney.findFirst({ where: { id: input.expectedMoneyId, userId } });
      if (!expected) throw new Error("Frozen money record not found");
      if (expected.status === ExpectedMoneyStatus.RECEIVED) throw new Error("Frozen money already returned");
      await tx.expectedMoney.update({
        where: { id: expected.id },
        data: { status: ExpectedMoneyStatus.RECEIVED, resolvedAt: new Date() }
      });
      const account = await this.requireAccount(tx, userId, input.destinationAccountId);
      const amount = roundCurrency(input.actualAmount, account.currency as CurrencyCode);
      await this.adjustAccount(tx, userId, input.destinationAccountId, amount, false);
      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EXPECTED_MONEY_RECEIVED,
          amount: amount.toString(),
          currency: account.currency,
          destinationAccountId: input.destinationAccountId,
          incomeSourceId: input.incomeSourceId,
          note: input.note || expected.note,
          transactionDate: input.transactionDate || new Date(),
          metadata: { expectedMoneyId: expected.id, plannedAmount: expected.amount.toString() }
        }
      });
    });
  }

  async freezeFunds(userId: string, input: {
    accountId: string;
    amount: Decimal.Value;
    currency: Currency;
    frozenDate: Date;
    note?: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const account = await this.requireAccount(tx, userId, input.accountId);
      if (account.currency !== input.currency) throw new Error("Currency mismatch");
      const amount = roundCurrency(input.amount, input.currency as CurrencyCode);
      const available = D(account.currentBalance).minus(await this.activeFrozenAmount(tx, userId, input.accountId));
      if (available.lt(amount)) throw new Error("Not enough available funds to freeze");
      const frozen = await tx.frozenFund.create({
        data: {
          userId,
          accountId: input.accountId,
          amount: amount.toString(),
          currency: input.currency,
          frozenDate: input.frozenDate,
          note: input.note
        }
      });
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.FUNDS_FROZEN,
          amount: amount.toString(),
          currency: input.currency,
          sourceAccountId: input.accountId,
          note: input.note,
          transactionDate: input.frozenDate,
          metadata: { frozenFundId: frozen.id }
        }
      });
      return frozen;
    });
  }

  async releaseFunds(userId: string, frozenFundId: string) {
    return this.db.$transaction(async (tx) => {
      const frozen = await tx.frozenFund.findFirst({ where: { id: frozenFundId, userId } });
      if (!frozen) throw new Error("Frozen fund not found");
      if (frozen.status !== FrozenFundStatus.FROZEN) throw new Error("Frozen fund is already resolved");
      const released = await tx.frozenFund.update({
        where: { id: frozen.id },
        data: { status: FrozenFundStatus.RELEASED, resolvedAt: new Date() }
      });
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.FUNDS_RELEASED,
          amount: frozen.amount,
          currency: frozen.currency,
          destinationAccountId: frozen.accountId,
          transactionDate: new Date(),
          metadata: { frozenFundId: frozen.id }
        }
      });
      return released;
    });
  }

  async archiveTransaction(userId: string, transactionId: string) {
    return this.db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({ where: { id: transactionId, userId } });
      if (!transaction) throw new Error("Transaction not found");
      if (transaction.archivedAt) return transaction;
      await this.applyTransactionEffect(tx, transaction, "reverse");
      const archived = await tx.transaction.update({
        where: { id: transaction.id },
        data: { archivedAt: new Date() }
      });
      await this.audit(tx, userId, "Transaction", transaction.id, "ARCHIVE", transaction, archived);
      return archived;
    });
  }

  async restoreTransaction(userId: string, transactionId: string) {
    return this.db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({ where: { id: transactionId, userId } });
      if (!transaction) throw new Error("Transaction not found");
      if (!transaction.archivedAt) return transaction;
      await this.applyTransactionEffect(tx, transaction, "apply");
      const restored = await tx.transaction.update({
        where: { id: transaction.id },
        data: { archivedAt: null }
      });
      await this.audit(tx, userId, "Transaction", transaction.id, "RESTORE", transaction, restored);
      return restored;
    });
  }

  async recalculateAccount(userId: string, accountId: string) {
    return this.db.$transaction(async (tx) => {
      const account = await this.requireAccount(tx, userId, accountId);
      const transactions = await tx.transaction.findMany({
        where: {
          userId,
          archivedAt: null,
          OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
        },
        orderBy: { transactionDate: "asc" }
      });
      let balance = D(account.initialBalance);
      for (const transaction of transactions) {
        balance = balance.plus(this.effectForAccount(transaction, accountId));
      }
      return tx.account.update({
        where: { id: accountId },
        data: { currentBalance: balance.toString() }
      });
    });
  }

  private async adjustAccount(tx: Tx, userId: string, accountId: string, delta: Decimal.Value, allowNegative: boolean) {
    const account = await this.requireAccount(tx, userId, accountId);
    const next = D(account.currentBalance).plus(delta);
    if (!allowNegative && next.lt(0)) {
      throw new Error(`Insufficient funds on ${account.name}`);
    }
    return tx.account.update({
      where: { id: accountId },
      data: { currentBalance: next.toString() }
    });
  }

  private async requireAccount(tx: Tx, userId: string, accountId: string) {
    const account = await tx.account.findFirst({ where: { id: accountId, userId, isActive: true } });
    if (!account) throw new Error("Account not found");
    return account;
  }

  private async getSettings(tx: Tx, userId: string) {
    const settings = await tx.settings.findUnique({ where: { userId } });
    if (!settings) throw new Error("Settings not found. Run seed or create defaults.");
    return settings;
  }

  private async findNamedAccount(tx: Tx, userId: string, name: string, currency: Currency) {
    const account = await tx.account.findFirst({ where: { userId, name, currency, isActive: true } });
    if (!account) throw new Error(`${name} account not found`);
    return account.id;
  }

  private async findFirstAccount(tx: Tx, userId: string, type: AccountType, currency: Currency) {
    const account = await tx.account.findFirst({ where: { userId, type, currency, isActive: true }, orderBy: { createdAt: "asc" } });
    if (!account) throw new Error(`${type} ${currency} account not found`);
    return account.id;
  }

  private async activeFrozenAmount(tx: Tx, userId: string, accountId: string) {
    const result = await tx.frozenFund.aggregate({
      where: { userId, accountId, status: FrozenFundStatus.FROZEN },
      _sum: { amount: true }
    });
    return D(result._sum.amount || 0);
  }

  private async applyTransactionEffect(tx: Tx, transaction: Awaited<ReturnType<Tx["transaction"]["findFirst"]>>, direction: "apply" | "reverse") {
    if (!transaction) return;
    const multiplier = direction === "apply" ? new Decimal(1) : new Decimal(-1);
    const sourceDelta = this.effectForAccount(transaction, transaction.sourceAccountId || "").times(multiplier);
    const destinationDelta = this.effectForAccount(transaction, transaction.destinationAccountId || "").times(multiplier);
    if (transaction.sourceAccountId && !sourceDelta.isZero()) {
      await this.adjustAccount(tx, transaction.userId, transaction.sourceAccountId, sourceDelta, false);
    }
    if (transaction.destinationAccountId && !destinationDelta.isZero()) {
      await this.adjustAccount(tx, transaction.userId, transaction.destinationAccountId, destinationDelta, false);
    }
  }

  private effectForAccount(transaction: {
    type: TransactionType;
    amount: Prisma.Decimal | Decimal.Value;
    convertedAmount: Prisma.Decimal | null;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
  }, accountId: string) {
    const amount = D(transaction.amount);
    const converted = D(transaction.convertedAmount || 0);
    if (accountId === transaction.sourceAccountId) {
      const debitTypes: TransactionType[] = [TransactionType.EXPENSE, TransactionType.P2P_WITHDRAWAL, TransactionType.CASH_WITHDRAWAL];
      if (debitTypes.includes(transaction.type)) {
        return amount.negated();
      }
    }
    if (accountId === transaction.destinationAccountId) {
      const directCreditTypes: TransactionType[] = [TransactionType.INCOME, TransactionType.EXPECTED_MONEY_RECEIVED, TransactionType.MANUAL_ADJUSTMENT];
      const convertedCreditTypes: TransactionType[] = [TransactionType.P2P_WITHDRAWAL, TransactionType.CASH_WITHDRAWAL];
      if (directCreditTypes.includes(transaction.type)) {
        return amount;
      }
      if (convertedCreditTypes.includes(transaction.type)) {
        return converted;
      }
    }
    return new Decimal(0);
  }

  private async audit(tx: Tx, userId: string, entityType: string, entityId: string, action: string, oldData: unknown, newData: unknown) {
    await tx.auditLog.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        oldData: oldData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue
      }
    });
  }
}

export const ledger = new LedgerService();
