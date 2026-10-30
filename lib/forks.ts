import { Prisma } from "@prisma/client";
import type { ForkTrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildForkSeries, inRange, summarizeForks } from "@/lib/forks-stats";
import type { ForkInputParsed } from "@/lib/forks-input";
import { D, roundCurrency } from "@/lib/money";
import { resolvePeriod, type PeriodInput } from "@/lib/period";

const money = (value: string | null | undefined) => (value == null ? null : roundCurrency(value, "USD").toString());

export function forkData(input: ForkInputParsed) {
  const [leg1, leg2] = input.legs;
  const total = input.total ?? D(leg1.stake).plus(leg2.stake).toString();
  return {
    status: input.status,
    placedAt: input.placedAt,
    sport: input.sport,
    match: input.match,
    tags: input.tags,
    leg1Book: leg1.book,
    leg1Pick: leg1.pick,
    leg1Odds: D(leg1.odds).toString(),
    leg1Stake: roundCurrency(leg1.stake, "USD").toString(),
    leg2Book: leg2.book,
    leg2Pick: leg2.pick,
    leg2Odds: D(leg2.odds).toString(),
    leg2Stake: roundCurrency(leg2.stake, "USD").toString(),
    total: roundCurrency(total, "USD").toString(),
    pnl: input.status === "SETTLED" ? money(input.pnl) : null,
    guaranteed: input.status === "OPEN" ? money(input.guaranteed) : null,
    note: input.note
  };
}

function sameFork(row: ForkTrade, data: ReturnType<typeof forkData>) {
  const dec = (value: Prisma.Decimal | null) => (value == null ? null : D(value.toString()).toString());
  const next = (value: string | null) => (value == null ? null : D(value).toString());
  return (
    row.status === data.status &&
    row.placedAt.getTime() === data.placedAt.getTime() &&
    row.match === data.match &&
    row.sport === data.sport &&
    row.note === data.note &&
    row.tags.join("\n") === data.tags.join("\n") &&
    row.leg1Book === data.leg1Book && row.leg1Pick === data.leg1Pick && row.leg2Book === data.leg2Book && row.leg2Pick === data.leg2Pick &&
    dec(row.leg1Odds) === next(data.leg1Odds) && dec(row.leg2Odds) === next(data.leg2Odds) &&
    dec(row.leg1Stake) === next(data.leg1Stake) && dec(row.leg2Stake) === next(data.leg2Stake) &&
    dec(row.total) === next(data.total) && dec(row.pnl) === next(data.pnl) && dec(row.guaranteed) === next(data.guaranteed)
  );
}

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Records a fork by its external id. The same fork again is a no-op (`duplicate`); an open fork that has been settled
 * since is updated in place. A settled fork is never reopened by a stale "open" resend.
 */
export async function upsertFork(userId: string, input: ForkInputParsed): Promise<{ fork: ForkTrade; duplicate: boolean; updated: boolean }> {
  const data = forkData(input);
  const find = () => prisma.forkTrade.findUnique({ where: { userId_externalId: { userId, externalId: input.externalId } } });
  const existing = await find();
  if (existing) return refresh(existing, data);
  try {
    const fork = await prisma.forkTrade.create({ data: { ...data, userId, externalId: input.externalId } });
    return { fork, duplicate: false, updated: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await find();
      if (winner) return refresh(winner, data);
    }
    throw error;
  }
}

async function refresh(existing: ForkTrade, data: ReturnType<typeof forkData>) {
  if ((existing.status === "SETTLED" && data.status === "OPEN") || sameFork(existing, data)) return { fork: existing, duplicate: true, updated: false };
  const fork = await prisma.forkTrade.update({ where: { id: existing.id }, data });
  return { fork, duplicate: false, updated: true };
}

export async function deleteFork(userId: string, ref: { id?: string | null; externalId?: string | null }) {
  if (!ref.id && !ref.externalId) throw new Error("Вкажи id або externalId вилки");
  const fork = await prisma.forkTrade.findFirst({ where: { userId, ...(ref.id ? { id: ref.id } : { externalId: ref.externalId as string }) } });
  if (!fork) return { status: "missing" as const };
  await prisma.forkTrade.delete({ where: { id: fork.id } });
  return { status: "deleted" as const, fork };
}

export async function listForks(userId: string, query: { from: Date; to: Date; limit: number }) {
  return prisma.forkTrade.findMany({
    where: { userId, placedAt: { gte: query.from, lte: query.to } },
    orderBy: { placedAt: "desc" },
    take: query.limit
  });
}

/** Name of the income source that collects extra income of the fork project (1win promos, cashback...). */
export const FORK_INCOME_SOURCE = "Вилки";

/** Regular income transactions booked on the "Вилки" source. Only USD/USDT rows count (1:1). */
export async function listForkIncome(userId: string, limit = 200) {
  const rows = await prisma.transaction.findMany({
    where: { userId, type: "INCOME", archivedAt: null, incomeSource: { name: FORK_INCOME_SOURCE } },
    orderBy: { transactionDate: "desc" },
    take: limit,
    select: { id: true, amount: true, currency: true, note: true, transactionDate: true }
  });
  return rows.filter((row) => row.currency === "USD" || row.currency === "USDT");
}

export type ForkIncomeRow = Awaited<ReturnType<typeof listForkIncome>>[number];

export function incomeFigures(rows: ForkIncomeRow[], range?: { gte: Date; lte: Date }) {
  const inside = range ? rows.filter((row) => row.transactionDate >= range.gte && row.transactionDate <= range.lte) : rows;
  const total = inside.reduce((sum, row) => sum.plus(D(row.amount.toString())), D(0));
  return { total: roundCurrency(total, "USD").toString(), count: inside.length };
}

async function loadForks(userId: string) {
  return prisma.forkTrade.findMany({ where: { userId }, orderBy: { placedAt: "desc" }, take: 2000 });
}

export async function getForksPage(userId: string, periodInput: PeriodInput) {
  const [rows, settings, bonuses] = await Promise.all([loadForks(userId), prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } }), listForkIncome(userId)]);
  const period = resolvePeriod(periodInput);
  const stats = summarizeForks(inRange(rows, period.range));
  const allTime = summarizeForks(rows);
  const withBonus = (net: string, bonus: string) => roundCurrency(D(net).plus(bonus), "USD").toString();
  const periodBonus = incomeFigures(bonuses, period.range);
  const allBonus = incomeFigures(bonuses);
  return {
    period,
    bonus: {
      period: { ...periodBonus, netWithBonus: withBonus(stats.net, periodBonus.total) },
      allTime: { ...allBonus, netWithBonus: withBonus(allTime.net, allBonus.total) },
      items: bonuses.slice(0, 50).map((row) => ({ id: row.id, amount: D(row.amount.toString()).toString(), receivedAt: row.transactionDate.toISOString(), note: row.note }))
    },
    stats,
    allTime,
    series: buildForkSeries(rows),
    hidden: Boolean(settings?.hideAmounts)
  };
}

export async function getForksSummary(userId: string) {
  const [rows, bonuses] = await Promise.all([loadForks(userId), listForkIncome(userId)]);
  const month = resolvePeriod({});
  const brief = (stats: ReturnType<typeof summarizeForks>) => {
    const copy: Partial<ReturnType<typeof summarizeForks>> = { ...stats };
    delete copy.settled;
    delete copy.timeline;
    return copy;
  };
  const all = brief(summarizeForks(rows));
  const monthly = brief(summarizeForks(inRange(rows, month.range)));
  delete monthly.byDay;
  delete monthly.byWeek;
  delete monthly.open;
  const allBonus = incomeFigures(bonuses);
  const monthBonus = incomeFigures(bonuses, month.range);
  const plus = (net: unknown, bonus: string) => roundCurrency(D(String(net)).plus(bonus), "USD").toString();
  return {
    allTime: { ...all, extraIncome: allBonus.total, netWithExtra: plus(all.net, allBonus.total) },
    month: { ...monthly, extraIncome: monthBonus.total, netWithExtra: plus(monthly.net, monthBonus.total) }
  };
}
