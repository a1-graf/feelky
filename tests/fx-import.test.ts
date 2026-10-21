import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;

/** In-memory stand-in for the few Prisma calls the FX services make, so the real service code runs. */
const store = vi.hoisted(() => ({ accounts: [] as Row[], trades: [] as Row[], transactions: [] as Row[], seq: 0 }));

vi.mock("@/lib/db", () => {
  const id = (prefix: string) => `${prefix}${++store.seq}`;
  const matchJson = (row: Row, where: Row) => {
    const meta = where.metadata;
    return !meta || (row.metadata && row.metadata[meta.path[0]] === meta.equals);
  };
  const db: Row = {
    account: {
      findFirst: async ({ where }: Row) =>
        store.accounts.find((a) => a.userId === where.userId && a.type === where.type && a.isActive && (!where.id || a.id === where.id) && (!where.name || a.name === where.name)) ??
        store.accounts.find((a) => !where.type && a.userId === where.userId && a.isActive && a.name === where.name) ??
        null,
      findFirstOrThrow: async ({ where }: Row) => store.accounts.find((a) => a.id === where.id)!,
      create: async ({ data }: Row) => {
        const row = { id: id("acc"), isActive: true, currentBalance: "0", ...data };
        store.accounts.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => Object.assign(store.accounts.find((a) => a.id === where.id)!, data)
    },
    fxTrade: {
      findUnique: async ({ where }: Row) => store.trades.find((t) => t.userId === where.userId_externalId.userId && t.externalId === where.userId_externalId.externalId) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: id("trade"), ...data };
        store.trades.push(row);
        return row;
      }
    },
    transaction: {
      findFirst: async ({ where }: Row) => store.transactions.find((t) => t.userId === where.userId && t.type === where.type && matchJson(t, where)) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: id("tx"), ...data };
        store.transactions.push(row);
        return row;
      }
    }
  };
  db.$transaction = async (callback: (tx: Row) => unknown) => callback(db);
  return { prisma: db };
});

import { buildFxImportPlan, runFxImport, summarizeFxImportPlan } from "@/lib/fx-import";

describe("FX import plan", () => {
  const plan = buildFxImportPlan();
  const summary = summarizeFxImportPlan(plan, new Date("2026-10-21T15:00:00Z"));

  it("has one trade per MT5 position and a unique id for every record", () => {
    expect(plan.trades).toHaveLength(42);
    expect(new Set(plan.trades.map((trade) => trade.externalId)).size).toBe(42);
    expect(new Set(plan.flows.map((flow) => flow.importId)).size).toBe(plan.flows.length);
  });

  it("starts with the 510 USD deposit of 1 October and takes the 15 USD withdrawal of 10 October off", () => {
    expect(plan.flows.map((flow) => [flow.direction, String(flow.amount), (flow.date as Date).toISOString()])).toEqual([
      ["deposit", "510.00", "2026-10-01T17:28:13.000Z"],
      ["withdraw", "15.00", "2026-10-10T16:35:40.000Z"]
    ]);
  });

  it("reproduces the real MT5 balance of 547.41", () => {
    expect(summary).toMatchObject({ deposited: "510", withdrawn: "15", balance: "547.41" });
    expect(summary.stats.totalPnl).toBe("52.41");
  });

  it("aggregates October and all time to the same figures (the account has only October trades)", () => {
    expect(summary.stats.byMonth.map((month) => [month.key, month.count])).toEqual([["2026-10", 42]]);
    expect(summary.stats.allTime).toMatchObject({ count: 42, pnl: "52.41", rCount: 42 });
    expect(summary.stats.allTime.sumR).toBe(summary.stats.byMonth[0].sumR);
  });

  it("gives every trade a known risk, so R is defined", () => {
    expect(plan.trades.every((trade) => Number(trade.riskAmount) > 0 && Number(trade.stopLoss) > 0)).toBe(true);
  });
});

describe("FX import is idempotent", () => {
  beforeEach(() => {
    store.accounts.length = 0;
    store.trades.length = 0;
    store.transactions.length = 0;
    store.seq = 0;
    store.accounts.push({ id: "main", userId: "u1", type: "CRYPTO_WALLET", name: "Мейн гаманець", currency: "USDT", isActive: true, currentBalance: "100" });
  });

  const snapshot = () => JSON.stringify({ accounts: store.accounts, trades: store.trades.length, transactions: store.transactions.length });

  it("creates the broker, posts flows and trades once and lands on 547.41", async () => {
    const first = await runFxImport("u1", { counterpartyName: "Мейн гаманець" });
    expect(first).toEqual({ trades: { created: 42, duplicate: 0 }, flows: { applied: 2, skipped: 0 } });
    const broker = store.accounts.find((account) => account.type === "BROKER")!;
    expect(broker).toMatchObject({ name: "FX брокер", currency: "USD", currentBalance: "547.41" });
    expect(store.accounts.find((account) => account.id === "main")!.currentBalance).toBe("-395");
    expect(store.trades).toHaveLength(42);
    expect(store.transactions.filter((tx) => tx.type === "TRANSFER")).toHaveLength(2);
  });

  it("changes nothing on a second run", async () => {
    await runFxImport("u1", { counterpartyName: "Мейн гаманець" });
    const before = snapshot();
    const second = await runFxImport("u1", { counterpartyName: "Мейн гаманець" });
    expect(second).toEqual({ trades: { created: 0, duplicate: 42 }, flows: { applied: 0, skipped: 2 } });
    expect(snapshot()).toBe(before);
  });

  it("records an external deposit without touching any other account", async () => {
    await runFxImport("u1");
    expect(store.accounts.find((account) => account.id === "main")!.currentBalance).toBe("100");
    expect(store.accounts.find((account) => account.type === "BROKER")!.currentBalance).toBe("547.41");
  });

  it("refuses a counterparty that does not exist", async () => {
    await expect(runFxImport("u1", { counterpartyName: "Немає такого" })).rejects.toThrow("не знайдено");
  });
});
