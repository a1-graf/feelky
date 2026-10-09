import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D, roundCurrency } from "@/lib/money";
import { balanceAfterSnapshot, summarizeWallet, sumSummaries } from "@/lib/steam-wallet-math";
import type { WalletSummary } from "@/lib/steam-wallet-math";

/**
 * Steam wallets are the resale accounts of the Steam module: each one is a Steam account whose
 * balance is kept in dollars (stored as USDT, like the rest of the module). Snapshots from the
 * agent, the bot or the site all go through `recordSteamBalance`.
 */

export const AGENT_SNAPSHOT_NOTE = "OpenClaw";
export const TELEGRAM_SNAPSHOT_NOTE = "Telegram";

export type SteamWallet = WalletSummary & {
  id: string;
  name: string;
  currency: string;
  updatedAt: Date | null;
  /** Who sent the latest balance: OpenClaw, Telegram or the site. */
  updatedBy: string | null;
  history: Array<{ at: Date; balance: string }>;
};

export async function listSteamAccounts(userId: string) {
  return prisma.steamResaleAccount.findMany({
    where: { userId, archivedAt: null, isActive: true },
    orderBy: { createdAt: "asc" }
  });
}

/** Exact id, or the name typed any case - an agent knows the accounts by name. */
export async function findSteamAccount(userId: string, nameOrId: string) {
  const value = nameOrId.trim();
  return prisma.steamResaleAccount.findFirst({
    where: {
      userId,
      archivedAt: null,
      isActive: true,
      OR: [{ id: value }, { name: { equals: value, mode: "insensitive" } }]
    }
  });
}

export type RecordBalanceResult = {
  duplicate: boolean;
  accountName: string;
  previousBalance: string;
  currentBalance: string;
  observedAt: Date;
  /** False when a newer snapshot already exists: history is filled in, the balance is left alone. */
  isLatest: boolean;
};

export async function recordSteamBalance(
  userId: string,
  input: { resaleAccountId: string; balance: Decimal.Value; observedAt: Date; note?: string | null }
): Promise<RecordBalanceResult> {
  const balance = roundCurrency(input.balance, "USDT");
  if (balance.lt(0)) throw new Error("Баланс не може бути мінусовим");
  // Kept exact: rounding it down could place it before a завоз saved in the same second,
  // which would then be counted twice. A retry sends the same time and still matches.
  const observedAt = new Date(input.observedAt.getTime());

  return prisma.$transaction(async (tx) => {
    const account = await tx.steamResaleAccount.findFirst({
      where: { id: input.resaleAccountId, userId, archivedAt: null, isActive: true }
    });
    if (!account) throw new Error("Steam-акаунт не знайдено");
    const previousBalance = account.currentSoftwareBalance.toString();
    const key = { resaleAccountId_snapshotDate: { resaleAccountId: account.id, snapshotDate: observedAt } };
    const existing = await tx.steamResaleBalanceSnapshot.findUnique({ where: key });
    if (existing && D(existing.balance).eq(balance)) {
      return { duplicate: true, accountName: account.name, previousBalance, currentBalance: previousBalance, observedAt, isLatest: true };
    }

    const snapshot = existing
      ? await tx.steamResaleBalanceSnapshot.update({ where: { id: existing.id }, data: { balance: balance.toString(), note: input.note ?? existing.note } })
      : await tx.steamResaleBalanceSnapshot.create({
          data: { userId, resaleAccountId: account.id, balance: balance.toString(), snapshotDate: observedAt, note: input.note ?? null }
        });
    await audit(tx, userId, "SteamResaleBalanceSnapshot", snapshot.id, existing ? "UPDATE" : "CREATE", existing, snapshot);

    const newer = await tx.steamResaleBalanceSnapshot.findFirst({
      where: { resaleAccountId: account.id, snapshotDate: { gt: observedAt } },
      select: { id: true }
    });
    if (newer) {
      return { duplicate: false, accountName: account.name, previousBalance, currentBalance: previousBalance, observedAt, isLatest: false };
    }

    const [laterInvestments, laterWithdrawals] = await Promise.all([
      tx.steamResaleInvestment.findMany({
        where: { resaleAccountId: account.id, archivedAt: null, createdAt: { gt: observedAt } },
        select: { receivedSteamAmount: true }
      }),
      tx.steamResaleWithdrawal.findMany({
        where: { resaleAccountId: account.id, archivedAt: null, createdAt: { gt: observedAt } },
        select: { softwareAmountSpent: true }
      })
    ]);
    const current = Decimal.max(0, balanceAfterSnapshot(balance, laterInvestments, laterWithdrawals));
    const updated = await tx.steamResaleAccount.update({
      where: { id: account.id },
      data: { currentSoftwareBalance: current.toString() }
    });
    await audit(tx, userId, "SteamResaleAccount", account.id, "SOFTWARE_BALANCE_UPDATE", account, updated);
    return { duplicate: false, accountName: account.name, previousBalance, currentBalance: current.toString(), observedAt, isLatest: true };
  });
}

export async function steamWallets(userId: string, options: { historyDays?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - (options.historyDays ?? 30) * 86_400_000);
  const accounts = await prisma.steamResaleAccount.findMany({
    where: { userId, archivedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      investments: { where: { archivedAt: null }, select: { externalAmount: true, receivedSteamAmount: true } },
      withdrawals: { where: { archivedAt: null }, select: { softwareAmountSpent: true, amountReceived: true } },
      snapshots: { where: { snapshotDate: { gte: since } }, orderBy: { snapshotDate: "asc" }, select: { balance: true, snapshotDate: true } }
    }
  });
  const latest = await prisma.steamResaleBalanceSnapshot.findMany({
    where: { userId, resaleAccountId: { in: accounts.map((account) => account.id) } },
    orderBy: [{ resaleAccountId: "asc" }, { snapshotDate: "desc" }],
    distinct: ["resaleAccountId"],
    select: { resaleAccountId: true, snapshotDate: true, note: true }
  });
  const latestByAccount = new Map(latest.map((item) => [item.resaleAccountId, item]));

  const wallets: SteamWallet[] = accounts.map((account) => {
    const last = latestByAccount.get(account.id);
    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      updatedAt: last?.snapshotDate ?? null,
      updatedBy: last ? last.note || "сайт" : null,
      history: account.snapshots.map((item) => ({ at: item.snapshotDate, balance: item.balance.toString() })),
      ...summarizeWallet({ balance: account.currentSoftwareBalance, investments: account.investments, withdrawals: account.withdrawals })
    };
  });
  return { wallets, totals: sumSummaries(wallets) };
}

export type SteamUndoOutcome = "undone" | "already" | "missing";

/**
 * Undo for a завоз saved from Telegram: the real money goes back to where it came from and
 * what was credited on Steam comes off the wallet. The claim on `archivedAt` makes a double
 * press a no-op.
 */
export async function undoSteamInvestment(userId: string, investmentId: string): Promise<SteamUndoOutcome> {
  return prisma.$transaction(async (tx) => {
    const investment = await tx.steamResaleInvestment.findFirst({ where: { id: investmentId, userId } });
    if (!investment) return "missing";
    const claimed = await tx.steamResaleInvestment.updateMany({
      where: { id: investment.id, userId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (claimed.count === 0) return "already";

    const source = await tx.account.findFirst({ where: { id: investment.sourceAccountId, userId } });
    if (source) {
      await tx.account.update({
        where: { id: source.id },
        data: { currentBalance: D(source.currentBalance).plus(investment.externalAmount).toString() }
      });
    }
    const wallet = await tx.steamResaleAccount.findFirst({ where: { id: investment.resaleAccountId, userId } });
    if (wallet) {
      const next = Decimal.max(0, D(wallet.currentSoftwareBalance).minus(investment.receivedSteamAmount));
      await tx.steamResaleAccount.update({ where: { id: wallet.id }, data: { currentSoftwareBalance: next.toString() } });
    }
    await audit(tx, userId, "SteamResaleInvestment", investment.id, "CREATE_UNDO", investment, { ...investment, archivedAt: new Date() });
    return "undone";
  });
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, oldData: unknown, newData: unknown) {
  await tx.auditLog.create({
    data: {
      userId,
      entityType,
      entityId,
      action,
      oldData: (oldData ?? undefined) as Prisma.InputJsonValue | undefined,
      newData: (newData ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}
