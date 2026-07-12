import { AccountType, Prisma, TransactionType } from "@prisma/client";
import type { Flip } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, roundCurrency } from "@/lib/money";
import { MAIN_WALLET_NAME } from "@/lib/user-defaults";

type Tx = Prisma.TransactionClient;

type FlipSummaryInput = Pick<Flip, "id" | "setup" | "pnl" | "tradeDate" | "note">;

export function summarizeFlips(flips: FlipSummaryInput[], now = new Date()) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyFlips = flips.filter((flip) => flip.tradeDate >= monthStart);
  const totalPnl = flips.reduce((sum, flip) => sum.plus(flip.pnl), new Prisma.Decimal(0));
  const monthPnl = monthlyFlips.reduce((sum, flip) => sum.plus(flip.pnl), new Prisma.Decimal(0));
  const wins = flips.filter((flip) => D(flip.pnl).gt(0)).length;
  const losses = flips.filter((flip) => D(flip.pnl).lt(0)).length;
  const setupMap = new Map<string, { pnl: Prisma.Decimal; count: number; wins: number; losses: number }>();

  for (const flip of flips) {
    const current = setupMap.get(flip.setup) || { pnl: new Prisma.Decimal(0), count: 0, wins: 0, losses: 0 };
    const pnl = D(flip.pnl);
    current.pnl = current.pnl.plus(pnl);
    current.count += 1;
    if (pnl.gt(0)) current.wins += 1;
    if (pnl.lt(0)) current.losses += 1;
    setupMap.set(flip.setup, current);
  }

  return {
    totalPnl: totalPnl.toString(),
    monthPnl: monthPnl.toString(),
    count: flips.length,
    wins,
    losses,
    winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
    setups: Array.from(setupMap.entries())
      .map(([setup, value]) => ({
        setup,
        pnl: value.pnl.toString(),
        count: value.count,
        wins: value.wins,
        losses: value.losses,
        winRate: value.wins + value.losses ? Math.round((value.wins / (value.wins + value.losses)) * 100) : 0
      }))
      .sort((a, b) => Number(b.pnl) - Number(a.pnl)),
    recent: flips.slice(0, 8).map((flip) => ({
      id: flip.id,
      setup: flip.setup,
      pnl: flip.pnl.toString(),
      tradeDate: flip.tradeDate.toISOString(),
      note: flip.note
    }))
  };
}

export async function getFlipStatistics(userId: string) {
  const [flips, settings] = await Promise.all([
    prisma.flip.findMany({ where: { userId }, orderBy: { tradeDate: "desc" }, take: 120 }),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } })
  ]);
  return { data: summarizeFlips(flips), hidden: Boolean(settings?.hideAmounts) };
}

function flipMetadata(flipId: string, setup: string) {
  return { flipId, flipSetup: setup, source: "FLIP_PNL" };
}

function metadataFlipId(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).flipId;
  return typeof value === "string" ? value : null;
}

async function findMainWallet(tx: Tx, userId: string) {
  const account = await tx.account.findFirst({
    where: {
      userId,
      name: MAIN_WALLET_NAME,
      currency: "USDT",
      isActive: true,
      type: { in: [AccountType.EXCHANGE, AccountType.CRYPTO_WALLET, AccountType.OTHER] }
    },
    orderBy: { createdAt: "asc" }
  });
  if (!account) throw new Error("Мейн гаманець USDT не знайдено");
  return account;
}

export async function postFlipToMainWallet(tx: Tx, userId: string, flip: Pick<Flip, "id" | "setup" | "pnl" | "tradeDate" | "note">) {
  const amount = roundCurrency(flip.pnl, "USDT");
  const mainWallet = await findMainWallet(tx, userId);
  const nextBalance = D(mainWallet.currentBalance).plus(amount);
  if (nextBalance.lt(0)) throw new Error(`Недостатньо USDT на ${MAIN_WALLET_NAME}`);

  await tx.account.update({
    where: { id: mainWallet.id },
    data: { currentBalance: nextBalance.toString() }
  });

  return tx.transaction.create({
    data: {
      userId,
      type: TransactionType.MANUAL_ADJUSTMENT,
      amount: amount.toString(),
      currency: "USDT",
      destinationAccountId: mainWallet.id,
      note: flip.note || `Фліп: ${flip.setup}`,
      transactionDate: flip.tradeDate,
      metadata: flipMetadata(flip.id, flip.setup)
    }
  });
}

export async function createFlipWithLedger(userId: string, input: { setup: string; pnl: number; tradeDate: Date; note?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const flip = await tx.flip.create({
      data: {
        userId,
        setup: input.setup,
        pnl: input.pnl,
        tradeDate: input.tradeDate,
        note: input.note
      }
    });
    await postFlipToMainWallet(tx, userId, flip);
    return flip;
  });
}

export async function syncUnpostedFlips(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [flips, flipTransactions] = await Promise.all([
      tx.flip.findMany({ where: { userId }, orderBy: { tradeDate: "asc" } }),
      tx.transaction.findMany({
        where: { userId, type: TransactionType.MANUAL_ADJUSTMENT },
        select: { metadata: true }
      })
    ]);
    const postedFlipIds = new Set(flipTransactions.map((item) => metadataFlipId(item.metadata)).filter(Boolean));
    const unposted = flips.filter((flip) => !postedFlipIds.has(flip.id));
    for (const flip of unposted) {
      await postFlipToMainWallet(tx, userId, flip);
    }
    return { posted: unposted.length };
  });
}
