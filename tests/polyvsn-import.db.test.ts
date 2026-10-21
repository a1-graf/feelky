import { describe, expect, it, beforeAll, afterAll } from "vitest";

// Needs a migrated Postgres (DATABASE_URL), e.g. pglite-socket. Skipped unless POLY_IMPORT_DB_TEST=1.
const enabled = process.env.POLY_IMPORT_DB_TEST === "1";

describe.skipIf(!enabled)("Polyvsn import on a real database", () => {
  const email = `polyvsn-test-${Date.now()}@example.com`;
  let userId = "";

  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.create({ data: { email } });
    userId = user.id;
    await prisma.account.create({ data: { id: `${userId}-main`, userId, name: "Мейн гаманець", type: "EXCHANGE", currency: "USDT" } });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.polyLock.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("imports once, lands on 303.40 and is idempotent", async () => {
    const { prisma } = await import("@/lib/db");
    const { runPolyvsnImport } = await import("@/lib/polyvsn-import");
    const { getPolyOverview } = await import("@/lib/poly");

    const first = await runPolyvsnImport(userId, { accountName: "Мейн гаманець", allowOverdraft: true });
    expect(first.trades).toMatchObject({ created: 26, updated: 0, duplicate: 0, failed: 0 });
    expect(first.flows.every((flow) => flow.status === "applied")).toBe(true);

    const snapshot = async () => {
      const [pool, main, tx, trades, locks] = await Promise.all([
        prisma.account.findUniqueOrThrow({ where: { id: `${userId}-polymarket` } }),
        prisma.account.findUniqueOrThrow({ where: { id: `${userId}-main` } }),
        prisma.transaction.count({ where: { userId } }),
        prisma.polyTrade.count({ where: { userId } }),
        prisma.polyLock.findMany({ where: { userId } })
      ]);
      return { pool: pool.currentBalance.toString(), main: main.currentBalance.toString(), tx, trades, locks: locks.map((lock) => [lock.agentName, lock.amountUsd.toString(), lock.status]) };
    };
    const after = await snapshot();
    expect(after.pool).toBe("52.63");
    expect(after.main).toBe("-332.03");
    expect(after.trades).toBe(26);
    expect(after.locks).toEqual([["AI Quantum Predator", "250.77", "LOCKED"]]);

    const overview = await getPolyOverview(userId, new Date("2026-10-21T00:00:00Z"));
    expect(overview.pool).toMatchObject({ balance: "52.63", lockedPrincipal: "250.77", total: "303.4" });
    expect(overview.all.totalPnl).toBe("-56.91");
    expect(overview.reconcile).toMatchObject({ ok: true });

    const second = await runPolyvsnImport(userId, { accountName: "Мейн гаманець", allowOverdraft: true });
    expect(second.trades).toMatchObject({ created: 0, updated: 0, duplicate: 26, failed: 0 });
    expect(second.flows.every((flow) => flow.status === "skipped")).toBe(true);
    expect(await snapshot()).toEqual(after);
  });
});
