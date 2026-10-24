import { describe, expect, it } from "vitest";
import { buildBankHistory, bankSeries } from "@/lib/bank-history";

const base = {
  now: new Date("2026-10-10T12:00:00Z"),
  rate: 40,
  polyPoolId: "poly",
  accounts: [
    { id: "wallet", type: "CRYPTO_WALLET", currency: "USDT", isReserved: false },
    { id: "card", type: "BANK_CARD", currency: "UAH", isReserved: false },
    { id: "poly", type: "OTHER", currency: "USDT", isReserved: false }
  ],
  expected: [],
  frozen: [],
  polyLocks: [],
  steamInvestments: [],
  steamRounds: [],
  steamWithdrawals: []
};

const tx = (over: Record<string, unknown>) => ({
  type: "INCOME", amount: "0", currency: "USDT", convertedAmount: null, sourceAccountId: null, destinationAccountId: null, metadata: null,
  transactionDate: new Date("2026-10-01T00:00:00Z"), ...over
}) as never;

describe("buildBankHistory", () => {
  it("ends exactly on the live figures and undoes earlier events", () => {
    const history = buildBankHistory({
      ...base,
      current: { total: 150, available: 100, turnover: 50 },
      transactions: [
        tx({ type: "INCOME", amount: "100", destinationAccountId: "wallet", transactionDate: new Date("2026-10-02T00:00:00Z") }),
        tx({ type: "TRANSFER", amount: "50", sourceAccountId: "wallet", destinationAccountId: "poly", transactionDate: new Date("2026-10-05T00:00:00Z") })
      ]
    });
    const last = history[history.length - 1];
    expect(last).toMatchObject({ total: 150, available: 100, turnover: 50 });
    expect(history[0]).toMatchObject({ total: 50, available: 50, turnover: 0 });
    const afterIncome = history.find((point) => point.t === Date.parse("2026-10-02T00:00:00Z"));
    expect(afterIncome).toMatchObject({ total: 150, available: 150, turnover: 0 });
    const afterTransfer = history.find((point) => point.t === Date.parse("2026-10-05T00:00:00Z"));
    expect(afterTransfer).toMatchObject({ total: 150, available: 100, turnover: 50 });
  });

  it("converts UAH accounts at the rate and merges events within one second", () => {
    const history = buildBankHistory({
      ...base,
      current: { total: 10, available: 10, turnover: 0 },
      transactions: [
        tx({ type: "INCOME", amount: "400", currency: "UAH", destinationAccountId: "card", transactionDate: new Date("2026-10-03T10:00:00.000Z") }),
        tx({ type: "INCOME", amount: "0.01", destinationAccountId: "wallet", transactionDate: new Date("2026-10-03T10:00:00.400Z") })
      ]
    });
    expect(history[0].available).toBe(-0.01);
    expect(history.filter((point) => Math.floor(point.t / 1000) === Math.floor(Date.parse("2026-10-03T10:00:00Z") / 1000))).toHaveLength(1);
  });

  it("returns a flat line when nothing happened", () => {
    const history = buildBankHistory({ ...base, current: { total: 5, available: 5, turnover: 0 }, transactions: [] });
    expect(history).toEqual([{ t: base.now.getTime(), total: 5, available: 5, turnover: 0 }]);
  });
});

describe("bankSeries", () => {
  it("carries the change since the previous point", () => {
    const points = [{ t: 1, total: 10, available: 4, turnover: 6 }, { t: 2, total: 12, available: 3, turnover: 9 }];
    expect(bankSeries(points, "available")).toEqual([{ t: 1, total: 4, delta: 0 }, { t: 2, total: 3, delta: -1 }]);
  });
});

describe("bankChange", () => {
  const points = [
    { t: 100, total: 50, available: 50, turnover: 0 },
    { t: 200, total: 150, available: 100, turnover: 50 },
    { t: 300, total: 130, available: 80, turnover: 50 }
  ];

  it("is the difference of the values at the window edges", async () => {
    const { bankChange } = await import("@/lib/bank-history");
    expect(bankChange(points, "total", 150, 400)).toBe(80);
    expect(bankChange(points, "turnover", 150, 250)).toBe(50);
  });

  it("starts from the first known value when the window opens before the history", async () => {
    const { bankChange } = await import("@/lib/bank-history");
    expect(bankChange(points, "total", 0, 400)).toBe(80);
    expect(bankChange([], "total", 0, 400)).toBe(0);
  });
});
