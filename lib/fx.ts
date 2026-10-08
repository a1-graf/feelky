import { AccountType, Prisma, TransactionType } from "@prisma/client";
import type { Account, FxSide, FxTrade } from "@prisma/client";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { summarizeFx } from "@/lib/fx-stats";
import { D, roundCurrency } from "@/lib/money";

type Tx = Prisma.TransactionClient;
type CurrencyCode = "UAH" | "USDT" | "USD";

export const FX_BROKER_ACCOUNT_NAME = "FX брокер";

export type FxTradeInput = {
  externalId?: string | null;
  instrument: string;
  side: FxSide;
  lots?: Decimal.Value | null;
  openPrice?: Decimal.Value | null;
  closePrice?: Decimal.Value | null;
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

export async function listFxTrades(userId: string, query: { from: Date; to: Date; limit: number }) {
  return prisma.fxTrade.findMany({
    where: { userId, closedAt: { gte: query.from, lte: query.to } },
    orderBy: { closedAt: "desc" },
    take: query.limit,
    include: { account: { select: { name: true, currency: true } } }
  });
}

export async function getFxStatistics(userId: string) {
  const [trades, settings, brokers] = await Promise.all([
    prisma.fxTrade.findMany({ where: { userId }, orderBy: { closedAt: "desc" }, take: 1000 }),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.account.findMany({
      where: { userId, isActive: true, type: AccountType.BROKER },
      orderBy: { createdAt: "asc" },
      select: { name: true, currency: true, currentBalance: true }
    })
  ]);
  return {
    data: summarizeFx(trades.map((trade) => ({ ...trade, side: trade.side }))),
    brokers: brokers.map((broker) => ({ name: broker.name, currency: broker.currency, balance: broker.currentBalance.toString() })),
    hidden: Boolean(settings?.hideAmounts)
  };
}
