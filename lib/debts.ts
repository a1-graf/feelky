import { DebtDirection, DebtStatus, Prisma, TransactionType } from "@prisma/client";
import type { Currency } from "@prisma/client";
import Decimal from "decimal.js";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { debtBalance, debtTotals, debtTransactionType, toUsdt } from "@/lib/debt-math";
import { ledger, syncDebtStatus } from "@/lib/ledger";
import { D, roundCurrency } from "@/lib/money";

type Tx = Prisma.TransactionClient;
type CurrencyCode = "UAH" | "USDT" | "USD";

export class DebtError extends Error {}

async function requireAccount(tx: Tx, userId: string, accountId: string, currency: Currency) {
  const account = await tx.account.findFirst({ where: { id: accountId, userId, isActive: true } });
  if (!account) throw new DebtError("Рахунок не знайдено");
  if (account.currency !== currency) throw new DebtError(`Борг у ${currency}, а рахунок «${account.name}» у ${account.currency}: обери рахунок у тій самій валюті`);
  return account;
}

async function requireDebt(tx: Tx, userId: string, debtId: string) {
  const debt = await tx.debt.findFirst({ where: { id: debtId, userId, archivedAt: null } });
  if (!debt) throw new DebtError("Борг не знайдено");
  return debt;
}

async function moveMoney(tx: Tx, input: {
  userId: string;
  debt: { id: string; direction: DebtDirection; counterparty: string; currency: Currency };
  role: "principal" | "repayment";
  accountId: string;
  amount: Decimal;
  date: Date;
  note?: string | null;
}) {
  const type = debtTransactionType(input.debt.direction, input.role) === "DEBT_IN" ? TransactionType.DEBT_IN : TransactionType.DEBT_OUT;
  const moneyIn = type === TransactionType.DEBT_IN;
  await ledger.adjustAccount(tx, input.userId, input.accountId, moneyIn ? input.amount : input.amount.negated(), false);
  return tx.transaction.create({
    data: {
      userId: input.userId,
      type,
      amount: input.amount.toString(),
      currency: input.debt.currency,
      sourceAccountId: moneyIn ? null : input.accountId,
      destinationAccountId: moneyIn ? input.accountId : null,
      note: input.note || input.debt.counterparty,
      transactionDate: input.date,
      debtId: input.debt.id,
      metadata: { debtId: input.debt.id, debtRole: input.role, debtDirection: input.debt.direction, counterparty: input.debt.counterparty }
    }
  });
}

/**
 * A new debt. With an account, the money really moves: a borrowed debt lands on it, a lent one leaves it.
 * Without one it is only a record (money that was already counted, or never passed through an account).
 */
export async function createDebt(userId: string, input: {
  direction: DebtDirection;
  counterparty: string;
  amount: Decimal.Value;
  currency: Currency;
  accountId?: string | null;
  startedAt: Date;
  dueDate?: Date | null;
  note?: string | null;
}) {
  const counterparty = input.counterparty.trim();
  if (!counterparty) throw new DebtError("Вкажи, з ким борг");
  const amount = roundCurrency(input.amount, input.currency as CurrencyCode);
  if (amount.lte(0)) throw new DebtError("Сума має бути більшою за нуль");
  return prisma.$transaction(async (tx) => {
    if (input.accountId) await requireAccount(tx, userId, input.accountId, input.currency);
    const debt = await tx.debt.create({
      data: {
        userId,
        direction: input.direction,
        counterparty,
        amount: amount.toString(),
        currency: input.currency,
        startedAt: input.startedAt,
        dueDate: input.dueDate ?? null,
        note: input.note?.trim() || null
      }
    });
    if (input.accountId) await moveMoney(tx, { userId, debt, role: "principal", accountId: input.accountId, amount, date: input.startedAt, note: input.note });
    await tx.auditLog.create({ data: { userId, entityType: "Debt", entityId: debt.id, action: "CREATE", newData: debt as unknown as Prisma.InputJsonValue } });
    return debt;
  });
}

/** A partial or full repayment: out of an account for a borrowed debt, into one for a lent debt. Never more than what is left. */
export async function repayDebt(userId: string, input: { debtId: string; amount?: Decimal.Value | null; accountId: string; date: Date; note?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const debt = await requireDebt(tx, userId, input.debtId);
    await requireAccount(tx, userId, input.accountId, debt.currency);
    const { left } = debtBalance(debt, await tx.transaction.findMany({ where: { debtId: debt.id } }));
    if (left.lte(0)) throw new DebtError("Цей борг уже повністю погашено");
    const amount = input.amount == null || input.amount === "" ? left : roundCurrency(input.amount, debt.currency as CurrencyCode);
    if (amount.lte(0)) throw new DebtError("Сума має бути більшою за нуль");
    if (amount.gt(left)) throw new DebtError(`Залишок боргу лише ${left.toString()} ${debt.currency}`);
    const transaction = await moveMoney(tx, { userId, debt, role: "repayment", accountId: input.accountId, amount, date: input.date, note: input.note });
    const updated = await syncDebtStatus(tx, debt.id);
    return { debt: updated ?? debt, transaction, left: left.minus(amount) };
  });
}

/** Removes a debt: every money move it made is taken back (balances return), then the debt is archived. */
export async function deleteDebt(userId: string, debtId: string) {
  return prisma.$transaction(async (tx) => {
    const debt = await requireDebt(tx, userId, debtId);
    const moves = await tx.transaction.findMany({ where: { debtId: debt.id, archivedAt: null }, orderBy: { transactionDate: "desc" } });
    // Repayments first, so a borrowed debt's money is never taken off an account twice.
    const ordered = [...moves.filter((item) => item.type !== debtTransactionType(debt.direction, "principal")), ...moves.filter((item) => item.type === debtTransactionType(debt.direction, "principal"))];
    for (const move of ordered) await ledger.archiveTransactionWithin(tx, userId, move.id, { debtRemoval: true });
    const archived = await tx.debt.update({ where: { id: debt.id }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, entityType: "Debt", entityId: debt.id, action: "DELETE", oldData: debt as unknown as Prisma.InputJsonValue } });
    return { debt: archived, reversed: moves.length };
  }, { timeout: 20000 });
}

export async function updateDebt(userId: string, debtId: string, input: { counterparty?: string; dueDate?: Date | null; note?: string | null }) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, archivedAt: null } });
  if (!debt) throw new DebtError("Борг не знайдено");
  return prisma.debt.update({
    where: { id: debt.id },
    data: { counterparty: input.counterparty?.trim() || undefined, dueDate: input.dueDate, note: input.note === undefined ? undefined : input.note?.trim() || null }
  });
}

export type DebtView = Awaited<ReturnType<typeof listDebts>>["debts"][number];

/** Every active debt with what is left, its repayments and the two totals in USDT at the site's rate. */
export async function listDebts(userId: string, rateValue?: Decimal.Value) {
  const [debts, rate] = await Promise.all([
    prisma.debt.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      include: { transactions: { orderBy: { transactionDate: "asc" }, include: { sourceAccount: true, destinationAccount: true } } }
    }),
    rateValue == null ? resolveUahUsdtRate(userId).then((data) => data.rate) : Promise.resolve(D(rateValue))
  ]);
  const views = debts.map((debt) => {
    const balance = debtBalance(debt, debt.transactions);
    const active = debt.transactions.filter((item) => !item.archivedAt);
    const principalMove = active.find((item) => item.type === debtTransactionType(debt.direction, "principal"));
    return {
      id: debt.id,
      direction: debt.direction,
      counterparty: debt.counterparty,
      amount: debt.amount.toString(),
      currency: debt.currency,
      startedAt: debt.startedAt,
      dueDate: debt.dueDate,
      status: balance.closed ? DebtStatus.CLOSED : DebtStatus.OPEN,
      closedAt: debt.closedAt,
      note: debt.note,
      repaid: balance.repaid.toString(),
      left: balance.left.toString(),
      leftUsdt: toUsdt(balance.left, debt.currency, rate).toString(),
      account: principalMove ? (principalMove.destinationAccount ?? principalMove.sourceAccount)?.name ?? null : null,
      accountId: principalMove ? principalMove.destinationAccountId ?? principalMove.sourceAccountId : null,
      overdue: !balance.closed && Boolean(debt.dueDate && debt.dueDate.getTime() < Date.now()),
      repayments: active
        .filter((item) => item.type !== debtTransactionType(debt.direction, "principal"))
        .map((item) => ({ id: item.id, amount: item.amount.toString(), date: item.transactionDate, account: (item.sourceAccount ?? item.destinationAccount)?.name ?? null, note: item.note }))
    };
  });
  const open = views.filter((debt) => debt.status === DebtStatus.OPEN);
  const totals = debtTotals(open.map((debt) => ({ direction: debt.direction, currency: debt.currency, left: debt.left })), rate);
  return {
    rate: rate.toString(),
    debts: views,
    totals: {
      owedUsdt: totals.owedUsdt.toString(),
      owedToMeUsdt: totals.owedToMeUsdt.toString(),
      openCount: open.length,
      byCurrency: (["UAH", "USDT", "USD"] as const).map((currency) => ({
        currency,
        owed: open.filter((debt) => debt.direction === "BORROWED" && debt.currency === currency).reduce((sum, debt) => sum.plus(debt.left), new Decimal(0)).toString(),
        owedToMe: open.filter((debt) => debt.direction === "LENT" && debt.currency === currency).reduce((sum, debt) => sum.plus(debt.left), new Decimal(0)).toString()
      })).filter((item) => !D(item.owed).isZero() || !D(item.owedToMe).isZero())
    }
  };
}

/** Finds an active debt by id or by the counterparty's name (case-insensitive); refuses when the name is ambiguous. */
export async function findDebt(userId: string, value: string) {
  const debts = await prisma.debt.findMany({ where: { userId, archivedAt: null }, orderBy: { startedAt: "asc" } });
  const byId = debts.find((debt) => debt.id === value);
  if (byId) return byId;
  const target = value.trim().toLowerCase();
  const matches = debts.filter((debt) => debt.counterparty.toLowerCase() === target);
  const open = matches.filter((debt) => debt.status === DebtStatus.OPEN);
  const pick = open.length === 1 ? open : matches;
  if (!pick.length) throw new DebtError(`Борг «${value}» не знайдено. Є: ${debts.map((debt) => `${debt.counterparty} (${debt.id})`).join(", ") || "нічого"}`);
  if (pick.length > 1) throw new DebtError(`Боргів «${value}» кілька — передай id: ${pick.map((debt) => debt.id).join(", ")}`);
  return pick[0];
}
