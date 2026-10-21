import { AccountType, Prisma, TransactionType } from "@prisma/client";
import type { Account, FxSide, FxTrade } from "@prisma/client";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { summarizeFx, summarizeFxFlows } from "@/lib/fx-stats";
import { D, roundCurrency } from "@/lib/money";

type Tx = Prisma.TransactionClient;
type CurrencyCode = "UAH" | "USDT" | "USD";

export const FX_BROKER_ACCOUNT_NAME = "FX брокер";
export const FX_FLOW_SOURCE = "FX_BROKER_FLOW";

export type FxTradeInput = {
  externalId?: string | null;
  instrument: string;
  side: FxSide;
  lots?: Decimal.Value | null;
  openPrice?: Decimal.Value | null;
  closePrice?: Decimal.Value | null;
  /** Initial stop-loss price. */
  stopLoss?: Decimal.Value | null;
  /** Initial risk in the broker currency (|entry - stopLoss| x lots x value per price unit); R = pnl / riskAmount. */
  riskAmount?: Decimal.Value | null;
  openedAt?: Date | null;
  closedAt: Date;
  /** Net result after commission and swap - this is what moves the broker balance. */
  pnl: Decimal.Value;
  commission?: Decimal.Value | null;
  swap?: Decimal.Value | null;
  setup?: string | null;
  note?: string | null;
  accountId?: string | null;
};

const optionalDecimal = (value: Decimal.Value | null | undefined) => (value == null ? null : D(value).toString());

async function findBrokerAccount(tx: Tx, userId: string, accountId?: string | null): Promise<Account> {
  const account = await tx.account.findFirst({
    where: { userId, isActive: true, type: AccountType.BROKER, ...(accountId ? { id: accountId } : {}) },
    orderBy: { createdAt: "asc" }
  });
  if (!account) throw new Error("Рахунок брокера не знайдено");
  return account;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Records a closed trade and posts its net PnL to the broker account in one transaction.
 * Sending the same externalId again returns the stored trade instead of a second one,
 * so an agent can safely retry.
 */
export async function createFxTradeWithLedger(userId: string, input: FxTradeInput): Promise<{ trade: FxTrade; duplicate: boolean }> {
  const externalId = input.externalId?.trim() || null;
  const findExisting = () =>
    externalId ? prisma.fxTrade.findUnique({ where: { userId_externalId: { userId, externalId } } }) : Promise.resolve(null);

  const existing = await findExisting();
  if (existing) return { trade: existing, duplicate: true };

  try {
    const trade = await prisma.$transaction(async (tx) => {
      const account = await findBrokerAccount(tx, userId, input.accountId);
      const pnl = roundCurrency(input.pnl, account.currency as CurrencyCode);
      const created = await tx.fxTrade.create({
        data: {
          userId,
          accountId: account.id,
          externalId,
          instrument: input.instrument.trim().toUpperCase(),
          side: input.side,
          lots: optionalDecimal(input.lots),
          openPrice: optionalDecimal(input.openPrice),
          closePrice: optionalDecimal(input.closePrice),
          stopLoss: optionalDecimal(input.stopLoss),
          riskAmount: optionalDecimal(input.riskAmount),
          openedAt: input.openedAt ?? null,
          closedAt: input.closedAt,
          pnl: pnl.toString(),
          commission: optionalDecimal(input.commission),
          swap: optionalDecimal(input.swap),
          setup: input.setup?.trim() || null,
          note: input.note?.trim() || null
        }
      });
      // The broker balance follows the trades even below zero: Feelky's view of the broker can be
      // incomplete (a deposit not entered yet), and rejecting a real trade would lose data.
      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: D(account.currentBalance).plus(pnl).toString() }
      });
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.MANUAL_ADJUSTMENT,
          amount: pnl.toString(),
          currency: account.currency,
          destinationAccountId: account.id,
          note: `FX ${created.instrument} ${created.side}${created.setup ? ` · ${created.setup}` : ""}`,
          transactionDate: input.closedAt,
          metadata: { source: "FX_PNL", fxTradeId: created.id }
        }
      });
      return created;
    });
    return { trade, duplicate: false };
  } catch (error) {
    // Two identical requests racing each other: the loser sees the winner's row.
    if (isUniqueViolation(error)) {
      const winner = await findExisting();
      if (winner) return { trade: winner, duplicate: true };
    }
    throw error;
  }
}

/** Removes a mistaken trade and takes its PnL back out of the broker balance. */
export async function deleteFxTradeWithLedger(userId: string, ref: { id?: string | null; externalId?: string | null }) {
  if (!ref.id && !ref.externalId) throw new Error("Вкажи id або externalId угоди");
  return prisma.$transaction(async (tx) => {
    const trade = await tx.fxTrade.findFirst({
      where: { userId, ...(ref.id ? { id: ref.id } : { externalId: ref.externalId as string }) }
    });
    if (!trade) return { status: "missing" as const };
    const posted = await tx.transaction.findFirst({
      where: { userId, type: TransactionType.MANUAL_ADJUSTMENT, archivedAt: null, metadata: { path: ["fxTradeId"], equals: trade.id } }
    });
    if (posted) {
      // Mirrors the posting: like it, the reversal may take the broker below zero.
      const account = await tx.account.findFirstOrThrow({ where: { id: posted.destinationAccountId as string, userId } });
      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: D(account.currentBalance).minus(posted.amount.toString()).toString() }
      });
      await tx.transaction.update({ where: { id: posted.id }, data: { archivedAt: new Date() } });
    }
    await tx.fxTrade.delete({ where: { id: trade.id } });
    return { status: "deleted" as const, trade };
  });
}

export type FxFlowInput = {
  direction: "deposit" | "withdraw";
  amount: Decimal.Value;
  date: Date;
  note?: string | null;
  /** Another own account the money comes from (deposit) or goes to (withdraw); without it the money enters or leaves Feelky's books. */
  counterpartyName?: string | null;
  accountId?: string | null;
  /** Stable id of a historical record: the same one is never posted twice. */
  importId?: string | null;
};

/** The broker account for FX; created on first use (the import needs it before any trade exists). */
export async function ensureFxBroker(userId: string): Promise<Account> {
  const existing = await prisma.account.findFirst({
    where: { userId, isActive: true, type: AccountType.BROKER },
    orderBy: { createdAt: "asc" }
  });
  if (existing) return existing;
  return prisma.account.create({
    data: { userId, type: AccountType.BROKER, name: FX_BROKER_ACCOUNT_NAME, currency: "USD", provider: "FxPro" }
  });
}

/**
 * Money put on or taken off the broker: a transfer, never income or spending, so it stays out of the
 * month totals and out of the trading PnL. The counterparty may go below zero - Feelky may not know the money yet.
 */
export async function moveFxBroker(userId: string, input: FxFlowInput): Promise<{ transaction: { id: string }; duplicate: boolean }> {
  const importId = input.importId?.trim() || null;
  const findExisting = () =>
    importId
      ? prisma.transaction.findFirst({
          where: { userId, type: TransactionType.TRANSFER, metadata: { path: ["importId"], equals: importId } },
          select: { id: true }
        })
      : Promise.resolve(null);
  const existing = await findExisting();
  if (existing) return { transaction: existing, duplicate: true };

  const transaction = await prisma.$transaction(async (tx) => {
    const broker = await findBrokerAccount(tx, userId, input.accountId);
    const amount = roundCurrency(input.amount, broker.currency as CurrencyCode);
    if (amount.lte(0)) throw new Error("Сума має бути більшою за нуль");
    const other = input.counterpartyName
      ? await tx.account.findFirst({ where: { userId, isActive: true, name: input.counterpartyName } })
      : null;
    if (input.counterpartyName && !other) throw new Error(`Рахунок «${input.counterpartyName}» не знайдено`);
    if (other && other.id === broker.id) throw new Error("Обери рахунок, відмінний від брокера");
    const deposit = input.direction === "deposit";
    const brokerFresh = await tx.account.findFirstOrThrow({ where: { id: broker.id } });
    await tx.account.update({
      where: { id: broker.id },
      data: { currentBalance: D(brokerFresh.currentBalance)[deposit ? "plus" : "minus"](amount).toString() }
    });
    if (other) {
      await tx.account.update({
        where: { id: other.id },
        data: { currentBalance: D(other.currentBalance)[deposit ? "minus" : "plus"](amount).toString() }
      });
    }
    return tx.transaction.create({
      data: {
        userId,
        type: TransactionType.TRANSFER,
        amount: amount.toString(),
        currency: broker.currency,
        sourceAccountId: deposit ? other?.id ?? null : broker.id,
        destinationAccountId: deposit ? broker.id : other?.id ?? null,
        note: input.note || (deposit ? "Поповнення FX брокера" : "Виведення з FX брокера"),
        transactionDate: input.date,
        metadata: { isTransfer: true, source: FX_FLOW_SOURCE, direction: input.direction, ...(importId ? { importId } : {}) }
      },
      select: { id: true }
    });
  });
  return { transaction, duplicate: false };
}

export async function listFxTrades(userId: string, query: { from: Date; to: Date; limit: number }) {
  return prisma.fxTrade.findMany({
    where: { userId, closedAt: { gte: query.from, lte: query.to } },
    orderBy: { closedAt: "desc" },
    take: query.limit,
    include: { account: { select: { name: true, currency: true } } }
  });
}

export async function getFxStatistics(userId: string) {
  const [trades, settings, brokers, flowRows] = await Promise.all([
    prisma.fxTrade.findMany({ where: { userId }, orderBy: { closedAt: "desc" }, take: 1000 }),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.account.findMany({
      where: { userId, isActive: true, type: AccountType.BROKER },
      orderBy: { createdAt: "asc" },
      select: { name: true, currency: true, currentBalance: true }
    }),
    prisma.transaction.findMany({
      where: { userId, type: TransactionType.TRANSFER, archivedAt: null, metadata: { path: ["source"], equals: FX_FLOW_SOURCE } },
      orderBy: { transactionDate: "desc" },
      select: { id: true, amount: true, transactionDate: true, note: true, metadata: true }
    })
  ]);
  return {
    data: summarizeFx(trades.map((trade) => ({ ...trade, side: trade.side }))),
    flows: summarizeFxFlows(
      flowRows.map((row) => ({
        id: row.id,
        amount: row.amount,
        date: row.transactionDate,
        note: row.note,
        direction: (row.metadata as { direction?: string } | null)?.direction === "withdraw" ? ("withdraw" as const) : ("deposit" as const)
      }))
    ),
    brokers: brokers.map((broker) => ({ name: broker.name, currency: broker.currency, balance: broker.currentBalance.toString() })),
    hidden: Boolean(settings?.hideAmounts)
  };
}
