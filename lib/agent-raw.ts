import { prisma } from "@/lib/db";

/**
 * Direct access to the user's own rows, for whatever no operation covers. It writes exactly
 * what it is given: nothing here moves a balance or keeps two tables in step, so an operation
 * is always the better tool when one exists.
 */

type Row = Record<string, unknown>;

type Delegate = {
  findMany(args: unknown): Promise<Row[]>;
  findFirst(args: unknown): Promise<Row | null>;
  create(args: unknown): Promise<Row>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};

const delegate = (value: unknown) => value as Delegate;

/** Every table that holds the user's finances. Sign-in and bot internals are left out. */
const TABLES: Record<string, Delegate> = {
  Account: delegate(prisma.account),
  Category: delegate(prisma.category),
  IncomeSource: delegate(prisma.incomeSource),
  Transaction: delegate(prisma.transaction),
  Flip: delegate(prisma.flip),
  FxTrade: delegate(prisma.fxTrade),
  PolyTrade: delegate(prisma.polyTrade),
  PolyLock: delegate(prisma.polyLock),
  ExpectedMoney: delegate(prisma.expectedMoney),
  ExpectedStatusDefinition: delegate(prisma.expectedStatusDefinition),
  FrozenFund: delegate(prisma.frozenFund),
  BalanceHistory: delegate(prisma.balanceHistory),
  Settings: delegate(prisma.settings),
  RecurringTransaction: delegate(prisma.recurringTransaction),
  SteamResaleAccount: delegate(prisma.steamResaleAccount),
  SteamResaleBalanceSnapshot: delegate(prisma.steamResaleBalanceSnapshot),
  SteamResaleInvestment: delegate(prisma.steamResaleInvestment),
  SteamResaleWithdrawal: delegate(prisma.steamResaleWithdrawal),
  SteamArbitrageScheme: delegate(prisma.steamArbitrageScheme),
  SteamArbitrageRound: delegate(prisma.steamArbitrageRound),
  SteamArbitrageResidual: delegate(prisma.steamArbitrageResidual),
  SteamExpenseAllocation: delegate(prisma.steamExpenseAllocation),
  AuditLog: delegate(prisma.auditLog)
};

export const RAW_TABLES = Object.keys(TABLES);

/** The audit trail can be read, not rewritten: it is what explains how a number came to be. */
const READ_ONLY = new Set(["AuditLog"]);

export class RawAccessError extends Error {
  constructor(message: string, readonly status: 404 | 409 | 422 = 422) {
    super(message);
  }
}

function table(name: string): Delegate {
  const found = TABLES[name] ?? TABLES[RAW_TABLES.find((key) => key.toLowerCase() === name.trim().toLowerCase()) ?? ""];
  if (!found) throw new RawAccessError(`Таблиці «${name}» немає. Є: ${RAW_TABLES.join(", ")}`);
  return found;
}

function writable(name: string): Delegate {
  const found = table(name);
  const canonical = RAW_TABLES.find((key) => key.toLowerCase() === name.trim().toLowerCase()) ?? name;
  if (READ_ONLY.has(canonical)) throw new RawAccessError(`Таблицю «${canonical}» можна тільки читати`, 409);
  return found;
}

/** A row always stays the user's own, and its key is never rewritten. */
function clean(data: Row): Row {
  const copy: Row = { ...data };
  delete copy.id;
  delete copy.userId;
  return copy;
}

export async function rawList(userId: string, input: { table: string; id?: string | null; limit?: number }) {
  const rows = await table(input.table).findMany({
    where: { userId, ...(input.id ? { id: input.id } : {}) },
    orderBy: { id: "desc" },
    take: Math.min(Math.max(input.limit ?? 50, 1), 500)
  });
  return rows;
}

export async function rawCreate(userId: string, input: { table: string; data: Row }) {
  return writable(input.table).create({ data: { ...clean(input.data), userId } });
}

export async function rawUpdate(userId: string, input: { table: string; id: string; data: Row }) {
  const target = writable(input.table);
  const updated = await target.updateMany({ where: { id: input.id, userId }, data: clean(input.data) });
  if (updated.count === 0) throw new RawAccessError("Запис не знайдено", 404);
  return target.findFirst({ where: { id: input.id, userId } });
}

export async function rawDelete(userId: string, input: { table: string; id: string }) {
  const removed = await writable(input.table).deleteMany({ where: { id: input.id, userId } });
  if (removed.count === 0) throw new RawAccessError("Запис не знайдено", 404);
  return { deleted: true };
}
