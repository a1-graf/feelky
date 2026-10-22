import { AccountType, PolyLockStatus, PolySection, PolyTradeStatus, Prisma, TransactionType } from "@prisma/client";
import type { Account, PolyLock, PolyTrade } from "@prisma/client";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D, roundCurrency } from "@/lib/money";
import { computePolyPnl, reconcilePool, summarizePoly } from "@/lib/poly-stats";
import type { PolyMarketKindKey, PolySectionKey, PolyStatusKey, PolyTradeLike } from "@/lib/poly-stats";

type Tx = Prisma.TransactionClient;

export const POLY_POOL_NAME = "Polymarket";
export const POLY_PNL_SOURCE = "POLY_PNL";
export const POLY_LOCK_SOURCE = "POLY_LOCK";
export const POLY_RELEASE_SOURCE = "POLY_RELEASE";
export const POLY_FLOW_SOURCE = "POLY_FLOW";

export type PolyTradeInput = {
  externalId: string;
  section: PolySectionKey;
  agentName?: string | null;
  walletRef?: string | null;
  marketSlug: string;
  title: string;
  marketKind: PolyMarketKindKey;
  outcome: string;
  entryPrice: Decimal.Value;
  sizeUsd: Decimal.Value;
  shares?: Decimal.Value | null;
  feesUsd?: Decimal.Value | null;
  status: PolyStatusKey;
  /** Net result after fees; computed from price and size when omitted. */
  pnl?: Decimal.Value | null;
  openedAt: Date;
  resolvedAt?: Date | null;
  signalPrice?: Decimal.Value | null;
  note?: string | null;
};

export type PolyUpsertStatus = "created" | "updated" | "duplicate";

const optionalDecimal = (value: Decimal.Value | null | undefined) => (value == null ? null : D(value).toString());
const money = (value: Decimal.Value) => roundCurrency(value, "USDT");

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The pool is a plain USDT exchange account (USDC counts 1:1), so net worth and the dashboard need no new currency. */
export async function ensurePolyPool(userId: string, db: Tx | typeof prisma = prisma): Promise<Account> {
  const id = `${userId}-polymarket`;
  return db.account.upsert({
    where: { id },
    update: { isActive: true },
    create: {
      id,
      userId,
      name: POLY_POOL_NAME,
      type: AccountType.EXCHANGE,
      provider: "Polymarket",
      currency: "USDT",
      initialBalance: "0",
      currentBalance: "0",
      note: "Пул Polymarket: вручну, копітрейд, AI-агенти (USDC ≈ USDT)"
    }
  });
}

async function postedPnlOf(tx: Tx, userId: string, tradeId: string) {
  const posted = await tx.transaction.findMany({
    where: { userId, type: TransactionType.MANUAL_ADJUSTMENT, archivedAt: null, metadata: { path: ["polyTradeId"], equals: tradeId } },
    select: { amount: true }
  });
  return posted.reduce((sum, row) => sum.plus(row.amount.toString()), D(0));
}

async function postToPool(tx: Tx, userId: string, pool: Account, delta: Decimal, meta: Record<string, string>, note: string, date: Date) {
  if (delta.isZero()) return;
  // The pool follows reality even below zero: Feelky may not know about a deposit yet, and refusing a real result would lose data.
  const fresh = await tx.account.findFirstOrThrow({ where: { id: pool.id } });
  await tx.account.update({ where: { id: pool.id }, data: { currentBalance: D(fresh.currentBalance).plus(delta).toString() } });
  await tx.transaction.create({
    data: {
      userId,
      type: TransactionType.MANUAL_ADJUSTMENT,
      amount: delta.toString(),
      currency: "USDT",
      destinationAccountId: pool.id,
      note,
      transactionDate: date,
      metadata: meta
    }
  });
}

/** Only manual and copied trades own pool money. An AI agent's trades happen inside its locked principal. */
const postsToPool = (section: PolySectionKey) => section !== "AI_AGENT";

function tradeData(input: PolyTradeInput) {
  const status = input.status;
  const pnl = status === "OPEN" ? D(0) : input.pnl != null ? D(input.pnl) : computePolyPnl({ ...input, status });
  return {
    section: input.section as PolySection,
    agentName: input.agentName?.trim() || null,
    walletRef: input.walletRef?.trim() || null,
    marketSlug: input.marketSlug.trim(),
    title: input.title.trim(),
    marketKind: input.marketKind,
    outcome: input.outcome.trim(),
    entryPrice: D(input.entryPrice).toString(),
    sizeUsd: money(input.sizeUsd).toString(),
    shares: optionalDecimal(input.shares),
    feesUsd: money(input.feesUsd ?? 0).toString(),
    status: status as PolyTradeStatus,
    pnlUsd: money(pnl).toString(),
    openedAt: input.openedAt,
    resolvedAt: status === "OPEN" ? null : (input.resolvedAt ?? input.openedAt),
    signalPrice: optionalDecimal(input.signalPrice),
    note: input.note?.trim() || null
  };
}

function sameTrade(existing: PolyTrade, next: ReturnType<typeof tradeData>) {
  const num = (a: Decimal.Value | null, b: Decimal.Value | null) => (a == null || b == null ? a == b : D(a).eq(D(b)));
  return (
    existing.section === next.section &&
    existing.agentName === next.agentName &&
    existing.walletRef === next.walletRef &&
    existing.marketSlug === next.marketSlug &&
    existing.title === next.title &&
    existing.marketKind === next.marketKind &&
    existing.outcome === next.outcome &&
    num(existing.entryPrice.toString(), next.entryPrice) &&
    num(existing.sizeUsd.toString(), next.sizeUsd) &&
    num(existing.shares?.toString() ?? null, next.shares) &&
    num(existing.feesUsd.toString(), next.feesUsd) &&
    existing.status === next.status &&
    num(existing.pnlUsd.toString(), next.pnlUsd) &&
    existing.openedAt.getTime() === next.openedAt.getTime() &&
    (existing.resolvedAt?.getTime() ?? null) === (next.resolvedAt?.getTime() ?? null) &&
    num(existing.signalPrice?.toString() ?? null, next.signalPrice) &&
    existing.note === next.note
  );
}

async function upsertOnce(userId: string, input: PolyTradeInput): Promise<{ trade: PolyTrade; status: PolyUpsertStatus }> {
  const data = tradeData(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.polyTrade.findUnique({ where: { userId_externalId: { userId, externalId: input.externalId } } });
    if (existing && sameTrade(existing, data)) return { trade: existing, status: "duplicate" as const };

    const trade = existing
      ? await tx.polyTrade.update({ where: { id: existing.id }, data })
      : await tx.polyTrade.create({ data: { ...data, userId, externalId: input.externalId } });

    // A trade that moved between sections must also move its money: the target is the new section's share.
    const target = postsToPool(input.section) ? D(trade.pnlUsd.toString()) : D(0);
    const pool = await ensurePolyPool(userId, tx);
    const delta = target.minus(await postedPnlOf(tx, userId, trade.id));
    await postToPool(
      tx,
      userId,
      pool,
      delta,
      { source: POLY_PNL_SOURCE, polyTradeId: trade.id },
      `Polymarket ${trade.title}${trade.agentName ? ` · ${trade.agentName}` : ""}`,
      trade.resolvedAt ?? trade.openedAt
    );
    return { trade, status: existing ? ("updated" as const) : ("created" as const) };
  });
}

/**
 * Creates or updates a trade by externalId. Re-sending identical data is a no-op ("duplicate"),
 * changed data (typically OPEN -> WON) updates the row and posts only the PnL difference to the pool.
 */
export async function upsertPolyTrade(userId: string, input: PolyTradeInput) {
  try {
    return await upsertOnce(userId, input);
  } catch (error) {
    // Two identical requests racing each other: the loser retries against the winner's row.
    if (isUniqueViolation(error)) return upsertOnce(userId, input);
    throw error;
  }
}

export type PolyBatchResult = {
  results: Array<{ index: number; externalId: string | null; status: PolyUpsertStatus | "error"; error?: string; id?: string }>;
  created: number;
  updated: number;
  duplicate: number;
  failed: number;
};

/** Items are independent: one bad row is reported and the rest still go in. */
export async function upsertPolyTrades(
  userId: string,
  items: Array<{ ok: true; input: PolyTradeInput } | { ok: false; externalId: string | null; error: string }>
): Promise<PolyBatchResult> {
  const out: PolyBatchResult = { results: [], created: 0, updated: 0, duplicate: 0, failed: 0 };
  for (const [index, item] of items.entries()) {
    if (!item.ok) {
      out.failed += 1;
      out.results.push({ index, externalId: item.externalId, status: "error", error: item.error });
      continue;
    }
    try {
      const { trade, status } = await upsertPolyTrade(userId, item.input);
      out[status] += 1;
      out.results.push({ index, externalId: item.input.externalId, status, id: trade.id });
    } catch (error) {
      out.failed += 1;
      console.error("[poly] upsert failed", error instanceof Error ? error.message : error);
      out.results.push({ index, externalId: item.input.externalId, status: "error", error: "Не вдалося зберегти угоду" });
    }
  }
  return out;
}

/** Removes a mistaken trade and takes its posted PnL back out of the pool. */
export async function deletePolyTrade(userId: string, ref: { id?: string | null; externalId?: string | null }) {
  if (!ref.id && !ref.externalId) throw new Error("Вкажи id або externalId угоди");
  return prisma.$transaction(async (tx) => {
    const trade = await tx.polyTrade.findFirst({
      where: { userId, ...(ref.id ? { id: ref.id } : { externalId: ref.externalId as string }) }
    });
    if (!trade) return { status: "missing" as const };
    const posted = await tx.transaction.findMany({
      where: { userId, type: TransactionType.MANUAL_ADJUSTMENT, archivedAt: null, metadata: { path: ["polyTradeId"], equals: trade.id } }
    });
    for (const row of posted) {
      const account = await tx.account.findFirstOrThrow({ where: { id: row.destinationAccountId as string, userId } });
      await tx.account.update({ where: { id: account.id }, data: { currentBalance: D(account.currentBalance).minus(row.amount.toString()).toString() } });
      await tx.transaction.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
    }
    await tx.polyTrade.delete({ where: { id: trade.id } });
    return { status: "deleted" as const, trade };
  });
}

export async function listPolyTrades(
  userId: string,
  query: { from: Date; to: Date; limit: number; section?: PolySectionKey; agentName?: string }
) {
  return prisma.polyTrade.findMany({
    where: {
      userId,
      openedAt: { gte: query.from, lte: query.to },
      ...(query.section ? { section: query.section as PolySection } : {}),
      ...(query.agentName ? { agentName: query.agentName } : {})
    },
    orderBy: { openedAt: "desc" },
    take: query.limit
  });
}

/* ---------------------------------------------------------------- pool flows */

async function requireAccountByName(tx: Tx, userId: string, name: string, currency: "USDT" = "USDT") {
  const account = await tx.account.findFirst({ where: { userId, name, currency, isActive: true } });
  if (!account) throw new Error(`Рахунок «${name}» (${currency}) не знайдено`);
  return account;
}

/** Money from a Feelky account into the pool (deposit) or back out of it (withdraw): a plain transfer between two USDT accounts. */
export async function movePolyFunds(
  userId: string,
  input: {
    direction: "deposit" | "withdraw";
    amount: Decimal.Value;
    accountName: string;
    date?: Date;
    note?: string | null;
    /** Historical import only: the source account may go below zero because Feelky did not know about the money yet. */
    allowOverdraft?: boolean;
    importId?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    const pool = await ensurePolyPool(userId, tx);
    const other = await requireAccountByName(tx, userId, input.accountName);
    if (other.id === pool.id) throw new Error("Обери рахунок, відмінний від пулу Polymarket");
    const amount = money(input.amount);
    if (amount.lte(0)) throw new Error("Сума має бути більшою за нуль");
    const from = input.direction === "deposit" ? other : pool;
    const to = input.direction === "deposit" ? pool : other;
    const fromFresh = await tx.account.findFirstOrThrow({ where: { id: from.id } });
    if (!input.allowOverdraft && D(fromFresh.currentBalance).lt(amount)) throw new Error(`Недостатньо коштів на «${from.name}»`);
    await tx.account.update({ where: { id: from.id }, data: { currentBalance: D(fromFresh.currentBalance).minus(amount).toString() } });
    const toFresh = await tx.account.findFirstOrThrow({ where: { id: to.id } });
    await tx.account.update({ where: { id: to.id }, data: { currentBalance: D(toFresh.currentBalance).plus(amount).toString() } });
    return tx.transaction.create({
      data: {
        userId,
        type: TransactionType.TRANSFER,
        amount: amount.toString(),
        currency: "USDT",
        sourceAccountId: from.id,
        destinationAccountId: to.id,
        note: input.note || (input.direction === "deposit" ? "Поповнення Polymarket" : "Виведення з Polymarket"),
        transactionDate: input.date ?? new Date(),
        metadata: { isTransfer: true, source: POLY_FLOW_SOURCE, direction: input.direction, ...(input.importId ? { importId: input.importId } : {}) }
      }
    });
  });
}

/** Pool correction that belongs to no single trade (e.g. settlements whose entry cost is unknown). Stays out of the per-trade PnL reconciliation. */
export const POLY_UNATTRIBUTED_SOURCE = "POLY_UNATTRIBUTED";

export async function postPolyAdjustment(userId: string, input: { amount: Decimal.Value; note: string; date: Date; importId?: string }) {
  return prisma.$transaction(async (tx) => {
    const pool = await ensurePolyPool(userId, tx);
    await postToPool(tx, userId, pool, D(input.amount), { source: POLY_UNATTRIBUTED_SOURCE, ...(input.importId ? { importId: input.importId } : {}) }, input.note, input.date);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Locks money inside an AI agent for `lockDays`. The principal leaves the pool (so it is not spendable)
 * but stays in net worth through the PolyLock row until it is released.
 */
export async function lockPolyFunds(
  userId: string,
  input: { amount: Decimal.Value; agentName: string; lockDays: number; lockedAt?: Date | null; note?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const pool = await ensurePolyPool(userId, tx);
    const amount = money(input.amount);
    if (amount.lte(0)) throw new Error("Сума має бути більшою за нуль");
    const fresh = await tx.account.findFirstOrThrow({ where: { id: pool.id } });
    if (D(fresh.currentBalance).lt(amount)) throw new Error("У пулі Polymarket недостатньо коштів для блокування");
    const lockedAt = input.lockedAt ?? new Date();
    const lock = await tx.polyLock.create({
      data: {
        userId,
        accountId: pool.id,
        section: PolySection.AI_AGENT,
        agentName: input.agentName.trim(),
        amountUsd: amount.toString(),
        lockedAt,
        unlockAt: new Date(lockedAt.getTime() + input.lockDays * DAY_MS),
        note: input.note?.trim() || null
      }
    });
    await postToPool(tx, userId, pool, amount.negated(), { source: POLY_LOCK_SOURCE, polyLockId: lock.id }, `Polymarket: блокування в ${lock.agentName}`, lockedAt);
    return lock;
  });
}

/** Takes the agent's money back: what came back lands in the pool, the difference to the principal is the agent's result. */
export async function releasePolyLock(
  userId: string,
  input: { lockId?: string | null; agentName?: string | null; returnedUsd: Decimal.Value; releasedAt?: Date | null; note?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    let lock: PolyLock | null = null;
    if (input.lockId) {
      lock = await tx.polyLock.findFirst({ where: { id: input.lockId, userId } });
    } else if (input.agentName) {
      const open = await tx.polyLock.findMany({
        where: { userId, agentName: input.agentName.trim(), status: PolyLockStatus.LOCKED },
        orderBy: { unlockAt: "asc" },
        take: 2
      });
      if (open.length > 1) throw new Error("Для цього агента кілька активних блокувань — вкажи lockId");
      lock = open[0] ?? null;
    } else {
      throw new Error("Вкажи lockId або agentName");
    }
    if (!lock) throw new Error("Блокування не знайдено");
    // Claiming the status first makes a double tap a no-op instead of a double credit.
    const claimed = await tx.polyLock.updateMany({ where: { id: lock.id, status: PolyLockStatus.LOCKED }, data: { status: PolyLockStatus.RELEASED } });
    if (claimed.count === 0) throw new Error("Це блокування вже знято");
    const returned = money(input.returnedUsd);
    const result = returned.minus(D(lock.amountUsd.toString()));
    const releasedAt = input.releasedAt ?? new Date();
    const pool = await ensurePolyPool(userId, tx);
    const updated = await tx.polyLock.update({
      where: { id: lock.id },
      data: { releasedAt, releasedAmountUsd: returned.toString(), resultPnlUsd: result.toString(), note: input.note?.trim() || lock.note }
    });
    await postToPool(tx, userId, pool, returned, { source: POLY_RELEASE_SOURCE, polyLockId: lock.id }, `Polymarket: повернення з ${lock.agentName}`, releasedAt);
    return { lock: updated, resultPnl: result };
  });
}

/* ------------------------------------------------------------------ queries */

/** Principal still locked in AI agents: money that is not in the pool but still belongs to the user. */
export async function lockedPolyPrincipal(userId: string, db: Tx | typeof prisma = prisma): Promise<Decimal> {
  const result = await db.polyLock.aggregate({ where: { userId, status: PolyLockStatus.LOCKED }, _sum: { amountUsd: true } });
  return D(result._sum.amountUsd?.toString() ?? 0);
}

function toLike(trade: PolyTrade): PolyTradeLike {
  return {
    id: trade.id,
    externalId: trade.externalId,
    section: trade.section,
    agentName: trade.agentName,
    marketSlug: trade.marketSlug,
    title: trade.title,
    marketKind: trade.marketKind,
    outcome: trade.outcome,
    entryPrice: trade.entryPrice.toString(),
    sizeUsd: trade.sizeUsd.toString(),
    shares: trade.shares?.toString() ?? null,
    feesUsd: trade.feesUsd.toString(),
    status: trade.status,
    pnlUsd: trade.pnlUsd.toString(),
    openedAt: trade.openedAt,
    resolvedAt: trade.resolvedAt,
    signalPrice: trade.signalPrice?.toString() ?? null
  };
}

export function polyTradesToLike(trades: PolyTrade[]) {
  return trades.map(toLike);
}

export function agentLockView(lock: PolyLock, now: Date = new Date()) {
  const msLeft = lock.unlockAt.getTime() - now.getTime();
  return {
    id: lock.id,
    agentName: lock.agentName,
    amountUsd: lock.amountUsd.toString(),
    lockedAt: lock.lockedAt.toISOString(),
    unlockAt: lock.unlockAt.toISOString(),
    status: lock.status,
    daysLeft: lock.status === PolyLockStatus.LOCKED ? Math.max(0, Math.ceil(msLeft / DAY_MS)) : 0,
    canRelease: lock.status === PolyLockStatus.LOCKED && msLeft <= 0,
    releasedAt: lock.releasedAt?.toISOString() ?? null,
    releasedAmountUsd: lock.releasedAmountUsd?.toString() ?? null,
    resultPnlUsd: lock.resultPnlUsd?.toString() ?? null
  };
}

/** Pool balance versus what its ledger rows add up to, and posted PnL versus the trade rows. */
export async function reconcilePolyPool(userId: string) {
  const pool = await prisma.account.findFirst({ where: { id: `${userId}-polymarket`, userId } });
  if (!pool) return null;
  const [rows, trades, locked] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, archivedAt: null, OR: [{ sourceAccountId: pool.id }, { destinationAccountId: pool.id }] },
      select: { type: true, amount: true, sourceAccountId: true, destinationAccountId: true, metadata: true }
    }),
    prisma.polyTrade.findMany({ where: { userId, section: { not: PolySection.AI_AGENT } }, select: { pnlUsd: true } }),
    lockedPolyPrincipal(userId)
  ]);
  let ledger = D(pool.initialBalance.toString());
  let posted = D(0);
  for (const row of rows) {
    const amount = D(row.amount.toString());
    if (row.type === TransactionType.TRANSFER) {
      if (row.sourceAccountId === pool.id) ledger = ledger.minus(amount);
      if (row.destinationAccountId === pool.id) ledger = ledger.plus(amount);
    } else if (row.destinationAccountId === pool.id) {
      ledger = ledger.plus(amount);
    } else if (row.sourceAccountId === pool.id && row.type === TransactionType.EXPENSE) {
      ledger = ledger.minus(amount);
    }
    const meta = row.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta) && (meta as Record<string, unknown>).source === POLY_PNL_SOURCE) posted = posted.plus(amount);
  }
  const tradesPnl = trades.reduce((sum, trade) => sum.plus(trade.pnlUsd.toString()), D(0));
  return {
    poolAccountId: pool.id,
    ...reconcilePool({ storedBalance: pool.currentBalance.toString(), ledgerBalance: ledger, postedTradePnl: posted, tradesPnl, lockedPrincipal: locked })
  };
}

export async function getPolyOverview(userId: string, now: Date = new Date()) {
  const [trades, locks, settings, pool, reconcile] = await Promise.all([
    prisma.polyTrade.findMany({ where: { userId }, orderBy: { openedAt: "desc" }, take: 5000 }),
    prisma.polyLock.findMany({ where: { userId }, orderBy: { lockedAt: "desc" } }),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }),
    prisma.account.findFirst({ where: { id: `${userId}-polymarket`, userId } }),
    reconcilePolyPool(userId)
  ]);
  const likes = polyTradesToLike(trades);
  const bySection = (section: PolySectionKey) => summarizePoly(likes.filter((trade) => trade.section === section), now);
  const locked = locks.filter((lock) => lock.status === PolyLockStatus.LOCKED).reduce((sum, lock) => sum.plus(lock.amountUsd.toString()), D(0));
  const lockedByAgent = new Map<string, ReturnType<typeof D>>();
  for (const lock of locks) {
    if (lock.status !== PolyLockStatus.LOCKED) continue;
    const name = lock.agentName || "Без назви";
    lockedByAgent.set(name, (lockedByAgent.get(name) ?? D(0)).plus(lock.amountUsd.toString()));
  }
  const releasedResult = locks.reduce((sum, lock) => sum.plus(lock.resultPnlUsd?.toString() ?? 0), D(0));
  return {
    all: summarizePoly(likes, now),
    sections: { MANUAL: bySection("MANUAL"), COPYTRADE: bySection("COPYTRADE"), AI_AGENT: bySection("AI_AGENT") },
    pool: {
      balance: pool?.currentBalance.toString() ?? "0",
      lockedPrincipal: locked.toString(),
      total: D(pool?.currentBalance.toString() ?? 0).plus(locked).toString()
    },
    locks: locks.map((lock) => agentLockView(lock, now)),
    lockedByAgent: Array.from(lockedByAgent.entries()).map(([agentName, amount]) => ({ agentName, amountUsd: amount.toString() })),
    releasedResult: releasedResult.toString(),
    reconcile,
    trades: trades.slice(0, 2000).map((trade) => ({
      id: trade.id,
      externalId: trade.externalId,
      section: trade.section,
      agentName: trade.agentName,
      marketKind: trade.marketKind,
      title: trade.title,
      outcome: trade.outcome,
      entryPrice: trade.entryPrice.toString(),
      sizeUsd: trade.sizeUsd.toString(),
      feesUsd: trade.feesUsd.toString(),
      status: trade.status,
      pnlUsd: trade.pnlUsd.toString(),
      openedAt: trade.openedAt.toISOString(),
      resolvedAt: trade.resolvedAt?.toISOString() ?? null,
      signalPrice: trade.signalPrice?.toString() ?? null,
      note: trade.note
    })),
    hidden: Boolean(settings?.hideAmounts)
  };
}
