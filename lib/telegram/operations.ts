import { AccountType, ExpectedMoneyStatus } from "@prisma/client";
import type { Account, Category, IncomeSource, Settings, TelegramSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createFlipWithLedger, undoFlipWithLedger } from "@/lib/flips";
import { ledger } from "@/lib/ledger";
import { D } from "@/lib/money";
import { SAVINGS_ACCOUNT_NAME } from "@/lib/user-defaults";
import { escapeHtml, formatAmount, formatKyivDateTime, kyivNow, truncate } from "@/lib/telegram/format";
import type { TelegramCurrency } from "@/lib/telegram/parse";
import { readLastIncomeAccount } from "@/lib/telegram/session";
import type { UndoGateway, UndoOutcome, UndoRef } from "@/lib/telegram/undo";

export const FALLBACK_REFERENCE_NAME = "Інше";

export type ReferenceData = {
  accounts: Account[];
  categories: Category[];
  incomeSources: IncomeSource[];
  settings: Settings | null;
};

export type OperationResult = {
  text: string;
  undo?: UndoRef;
};

export async function resolveFeelkyUserId(email: string): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  return user?.id ?? null;
}

export async function loadReferenceData(userId: string): Promise<ReferenceData> {
  const [accounts, categories, incomeSources, settings] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
    prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.settings.findUnique({ where: { userId } })
  ]);
  return { accounts, categories, incomeSources, settings };
}

export function accountsForCurrency(accounts: Account[], currency: TelegramCurrency): Account[] {
  return accounts.filter((account) => account.currency === currency);
}

export function savingsSourceAccounts(accounts: Account[]): Account[] {
  return accounts.filter((account) => account.currency === "UAH" && account.name !== SAVINGS_ACCOUNT_NAME);
}

export function findAccountById(accounts: Account[], id: string | null | undefined): Account | null {
  if (!id) return null;
  return accounts.find((account) => account.id === id) ?? null;
}

export function accountLabel(account: Account): string {
  return `${account.name} · ${formatAmount(account.currentBalance.toString(), account.currency)}`;
}

/** Default expense account: settings default, then the last one used from Telegram, then any account of that currency. */
export function pickExpenseAccount(data: ReferenceData, session: TelegramSession, currency: TelegramCurrency): Account | null {
  const candidates = accountsForCurrency(data.accounts, currency);
  if (!candidates.length) return null;
  const preferred = [data.settings?.expenseDefaultSourceId, session.lastExpenseAccountId];
  if (currency === "USDT") preferred.unshift(data.settings?.p2pSourceAccountId ?? null);
  for (const id of preferred) {
    const account = candidates.find((item) => item.id === id);
    if (account) return account;
  }
  return candidates[0];
}

/** Income accounts are remembered per currency, as asked. */
export function pickIncomeAccount(data: ReferenceData, session: TelegramSession, currency: TelegramCurrency): Account | null {
  const candidates = accountsForCurrency(data.accounts, currency);
  if (!candidates.length) return null;
  const remembered = candidates.find((item) => item.id === readLastIncomeAccount(session, currency));
  if (remembered) return remembered;
  const fallbackId = currency === "UAH" ? data.settings?.p2pDestinationAccountId : data.settings?.p2pSourceAccountId;
  const fallback = candidates.find((item) => item.id === fallbackId);
  if (fallback) return fallback;
  if (currency === "USD") {
    const cash = candidates.find((item) => item.type === AccountType.CASH);
    if (cash) return cash;
  }
  return candidates[0];
}

function byName<T extends { name: string }>(items: T[], name: string | null | undefined): T | null {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  return items.find((item) => item.name.toLowerCase() === target) ?? null;
}

export function findCategory(categories: Category[], name: string | null | undefined): Category | null {
  return byName(categories, name);
}

export function findIncomeSource(sources: IncomeSource[], name: string | null | undefined): IncomeSource | null {
  return byName(sources, name);
}

/** Last used, then `Інше`, then the first available one. */
export function fallbackReference<T extends { id: string; name: string }>(items: T[], lastId: string | null | undefined): T | null {
  if (!items.length) return null;
  const last = items.find((item) => item.id === lastId);
  if (last) return last;
  const other = byName(items, FALLBACK_REFERENCE_NAME);
  if (other) return other;
  return items[0];
}

function confirmation(title: string, rows: Array<[string, string | null | undefined]>): string {
  const lines = [`<b>${escapeHtml(title)}</b>`];
  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`${escapeHtml(label)}: ${escapeHtml(value)}`);
  }
  return lines.join("\n");
}

function noteText(note: string | null | undefined): string | null {
  if (!note) return null;
  return truncate(note, 160);
}

export type ExpenseInput = {
  amount: string;
  currency: TelegramCurrency;
  accountId: string;
  categoryId?: string | null;
  incomeSourceId?: string | null;
  note: string | null;
  isWorkExpense?: boolean;
};

export async function submitExpense(userId: string, input: ExpenseInput, data: ReferenceData): Promise<OperationResult> {
  const transaction = await ledger.createExpense(userId, {
    amount: input.amount,
    currency: input.currency,
    transactionDate: kyivNow(),
    categoryId: input.categoryId ?? null,
    incomeSourceId: input.incomeSourceId ?? null,
    sourceAccountId: input.accountId,
    note: input.note,
    isWorkExpense: input.isWorkExpense
  });
  const account = findAccountById(data.accounts, input.accountId);
  const category = data.categories.find((item) => item.id === input.categoryId);
  const incomeSource = data.incomeSources.find((item) => item.id === input.incomeSourceId);
  return {
    text: confirmation(input.isWorkExpense ? "Робоча витрата" : "Витрата", [
      ["Сума", formatAmount(transaction.amount.toString(), transaction.currency)],
      [input.isWorkExpense ? "Напрямок" : "Категорія", input.isWorkExpense ? incomeSource?.name : category?.name],
      ["Рахунок", account?.name],
      ["Примітка", noteText(input.note)],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export type IncomeInput = {
  amount: string;
  currency: TelegramCurrency;
  accountId: string;
  incomeSourceId: string;
  note: string | null;
};

export async function submitIncome(userId: string, input: IncomeInput, data: ReferenceData): Promise<OperationResult> {
  const transaction = await ledger.createIncome(userId, {
    amount: input.amount,
    currency: input.currency,
    transactionDate: kyivNow(),
    incomeSourceId: input.incomeSourceId,
    destinationAccountId: input.accountId,
    note: input.note
  });
  const account = findAccountById(data.accounts, input.accountId);
  const incomeSource = data.incomeSources.find((item) => item.id === input.incomeSourceId);
  return {
    text: confirmation("Дохід", [
      ["Сума", formatAmount(transaction.amount.toString(), transaction.currency)],
      ["Джерело", incomeSource?.name],
      ["Рахунок", account?.name],
      ["Примітка", noteText(input.note)],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export async function submitSavings(
  userId: string,
  input: { amount: string; accountId: string; note: string | null },
  data: ReferenceData
): Promise<OperationResult> {
  const transaction = await ledger.createSavingsDeposit(userId, {
    amount: input.amount,
    sourceAccountId: input.accountId,
    transactionDate: kyivNow(),
    note: input.note
  });
  const account = findAccountById(data.accounts, input.accountId);
  return {
    text: confirmation("Відкладення", [
      ["Сума", formatAmount(transaction.amount.toString(), "UAH")],
      ["Звідки", account?.name],
      ["Куди", SAVINGS_ACCOUNT_NAME],
      ["Примітка", noteText(input.note)],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export async function submitP2P(
  userId: string,
  input: { receivedUah: string; rateUahPerUsdt: string; note: string | null },
  data: ReferenceData
): Promise<OperationResult> {
  const transaction = await ledger.createP2PWithdrawal(userId, {
    receivedUah: input.receivedUah,
    rateUahPerUsdt: input.rateUahPerUsdt,
    transactionDate: kyivNow(),
    note: input.note
  });
  const source = findAccountById(data.accounts, transaction.sourceAccountId);
  const destination = findAccountById(data.accounts, transaction.destinationAccountId);
  return {
    text: confirmation("P2P-вивід", [
      ["Отримано", formatAmount(transaction.convertedAmount?.toString() ?? input.receivedUah, "UAH")],
      ["Курс", D(input.rateUahPerUsdt).toString()],
      ["Списано", formatAmount(transaction.amount.toString(), "USDT")],
      ["Звідки", source?.name],
      ["Куди", destination?.name],
      ["Примітка", noteText(input.note)],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export async function submitCash(
  userId: string,
  input: { receivedAmount: string; receivedCurrency: "UAH" | "USD"; rate: string; place: string | null },
  data: ReferenceData
): Promise<OperationResult> {
  const transaction = await ledger.createCashWithdrawal(userId, {
    receivedAmount: input.receivedAmount,
    receivedCurrency: input.receivedCurrency,
    rate: input.rate,
    transactionDate: kyivNow(),
    exchangePlace: input.place || data.settings?.cashExchangePlace || "Cashalot"
  });
  const source = findAccountById(data.accounts, transaction.sourceAccountId);
  const destination = findAccountById(data.accounts, transaction.destinationAccountId);
  return {
    text: confirmation("Вивід у готівку", [
      ["Отримано", formatAmount(transaction.convertedAmount?.toString() ?? input.receivedAmount, input.receivedCurrency)],
      ["Курс", D(input.rate).toString()],
      ["Списано", formatAmount(transaction.amount.toString(), "USDT")],
      ["Звідки", source?.name],
      ["Куди", destination?.name],
      ["Обмін", input.place || data.settings?.cashExchangePlace || "Cashalot"],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export async function submitManualAdjustment(
  userId: string,
  input: { accountId: string; newBalance: string },
  data: ReferenceData
): Promise<OperationResult> {
  const account = findAccountById(data.accounts, input.accountId);
  const previous = account ? account.currentBalance.toString() : "0";
  const transaction = await ledger.createManualAdjustment(userId, {
    accountId: input.accountId,
    newBalance: input.newBalance,
    note: "Telegram: ручне оновлення балансу"
  });
  const difference = D(transaction.amount.toString());
  const sign = difference.gte(0) ? "+" : "−";
  return {
    text: confirmation("Баланс оновлено", [
      ["Рахунок", account?.name],
      ["Було", formatAmount(previous, account?.currency ?? "UAH")],
      ["Стало", formatAmount(input.newBalance, account?.currency ?? "UAH")],
      ["Різниця", `${sign}${formatAmount(difference.abs().toString(), account?.currency ?? "UAH")}`],
      ["Дата", formatKyivDateTime(transaction.transactionDate)]
    ]),
    undo: { kind: "tx", id: transaction.id }
  };
}

export async function submitExpectedMoney(
  userId: string,
  input: { amount: string; currency: TelegramCurrency; title: string | null }
): Promise<OperationResult> {
  const record = await ledger.createExpectedMoney(userId, {
    title: input.title || "Заморожені бабки",
    amount: input.amount,
    currency: input.currency,
    status: ExpectedMoneyStatus.EXPECTED
  });
  return {
    text: confirmation("Очікувані гроші", [
      ["Сума", formatAmount(record.amount.toString(), record.currency)],
      ["Назва", record.title],
      ["Статус", "Заморожено"],
      ["Дата", formatKyivDateTime(record.createdAt)]
    ]),
    undo: { kind: "expected", id: record.id }
  };
}

export async function submitFlip(userId: string, input: { pnl: string; setup: string }): Promise<OperationResult> {
  const flip = await createFlipWithLedger(userId, {
    setup: input.setup,
    pnl: input.pnl,
    tradeDate: kyivNow()
  });
  const pnl = D(flip.pnl.toString());
  const sign = pnl.gte(0) ? "+" : "−";
  return {
    text: confirmation("Фліп", [
      ["PnL", `${sign}${formatAmount(pnl.abs().toString(), "USDT")}`],
      ["Сетап", flip.setup],
      ["Гаманець", "Мейн гаманець"],
      ["Дата", formatKyivDateTime(flip.tradeDate)]
    ]),
    undo: { kind: "flip", id: flip.id }
  };
}

/** Flip setups the user already used, plus their Steam scheme names - so setups are pickable, not typed. */
export async function loadFlipSetups(userId: string): Promise<string[]> {
  const [flips, schemes] = await Promise.all([
    prisma.flip.findMany({
      where: { userId },
      select: { setup: true },
      distinct: ["setup"],
      orderBy: { tradeDate: "desc" },
      take: 12
    }),
    prisma.steamArbitrageScheme.findMany({ where: { userId, isActive: true }, select: { name: true }, take: 12 })
  ]);
  const seen = new Set<string>();
  const setups: string[] = [];
  for (const name of [...flips.map((item) => item.setup), ...schemes.map((item) => item.name)]) {
    const key = name.trim().toLowerCase();
    if (!name.trim() || seen.has(key)) continue;
    seen.add(key);
    setups.push(name.trim());
  }
  return setups.slice(0, 12);
}

export async function formatBalances(userId: string): Promise<string> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }]
  });
  if (!accounts.length) return "Активних рахунків немає. Створи їх на сайті Feelky.";
  const lines = accounts.map(
    (account) => `${escapeHtml(account.name)}: <b>${escapeHtml(formatAmount(account.currentBalance.toString(), account.currency))}</b>`
  );
  return [`<b>Поточні баланси</b>`, ...lines].join("\n");
}

/** Everything the undo button touches. Each branch is safe to run twice. */
export const prismaUndoGateway: UndoGateway = {
  async archiveTransaction(userId: string, transactionId: string): Promise<UndoOutcome> {
    const existing = await prisma.transaction.findFirst({ where: { id: transactionId, userId }, select: { archivedAt: true } });
    if (!existing) return "missing";
    if (existing.archivedAt) return "already";
    await ledger.archiveTransaction(userId, transactionId);
    return "undone";
  },
  async undoFlip(userId: string, flipId: string): Promise<UndoOutcome> {
    const result = await undoFlipWithLedger(userId, flipId);
    return result.status === "undone" ? "undone" : "already";
  },
  async removeExpectedMoney(userId: string, expectedMoneyId: string): Promise<UndoOutcome> {
    const removed = await prisma.expectedMoney.deleteMany({
      where: { id: expectedMoneyId, userId, status: ExpectedMoneyStatus.EXPECTED }
    });
    if (removed.count > 0) return "undone";
    const stillThere = await prisma.expectedMoney.findFirst({ where: { id: expectedMoneyId, userId }, select: { id: true } });
    return stillThere ? "failed" : "already";
  }
};
