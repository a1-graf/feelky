import { describe, expect, it } from "vitest";
import { fxTradeInputSchema } from "@/lib/fx-input";
import { kyivMonthStart, rOf, summarizeFx, summarizeFxFlows, tradeR } from "@/lib/fx-stats";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const trade = (id: string, instrument: string, pnl: string, closedAt: string, setup: string | null = null) => ({
  id, instrument, side: "BUY" as const, pnl, closedAt: new Date(closedAt), setup, commission: "-1", swap: "0.5"
});

describe("FX statistics", () => {
  const trades = [
    trade("1", "EURUSD", "120", "2026-10-02T10:00:00Z", "breakout"),
    trade("2", "EURUSD", "-40", "2026-10-03T10:00:00Z", "breakout"),
    trade("3", "XAUUSD", "60", "2026-10-03T15:00:00Z", "news"),
    trade("4", "GBPUSD", "-20", "2026-09-28T10:00:00Z")
  ];
  const stats = summarizeFx(trades, NOW);

  it("sums PnL exactly with decimals", () => {
    expect(stats.totalPnl).toBe("120");
    expect(summarizeFx([trade("a", "EURUSD", "0.1", "2026-10-01T10:00:00Z"), trade("b", "EURUSD", "0.2", "2026-10-01T11:00:00Z")], NOW).totalPnl).toBe("0.3");
  });

  it("counts only this Kyiv month for the month PnL", () => {
    expect(stats.monthPnl).toBe("140");
    expect(stats.monthCount).toBe(3);
  });

  it("computes winrate, profit factor and averages", () => {
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.grossProfit).toBe("180");
    expect(stats.grossLoss).toBe("60");
    expect(stats.profitFactor).toBe("3");
    expect(stats.avgWin).toBe("90");
    expect(stats.avgLoss).toBe("30");
  });

  it("has no profit factor without a losing trade", () => {
    expect(summarizeFx([trade("x", "EURUSD", "10", "2026-10-01T10:00:00Z")], NOW).profitFactor).toBeNull();
  });

  it("totals commission and swap", () => {
    expect(stats.commission).toBe("-4");
    expect(stats.swap).toBe("2");
  });

  it("breaks down by instrument and setup, best first", () => {
    expect(stats.byInstrument.map((row) => [row.name, row.pnl])).toEqual([["EURUSD", "80"], ["XAUUSD", "60"], ["GBPUSD", "-20"]]);
    expect(stats.bySetup.find((row) => row.name === "Без сетапу")?.pnl).toBe("-20");
  });

  it("builds a cumulative daily timeline", () => {
    expect(stats.timeline.map((point) => [point.label, point.net])).toEqual([["28.09", -20], ["02.10", 100], ["03.10", 120]]);
    expect(stats.timeline[2]).toMatchObject({ profit: 60, loss: 40 });
  });

  it("picks the best and worst trade", () => {
    expect(stats.best?.pnl).toBe("120");
    expect(stats.worst?.pnl).toBe("-40");
  });

  it("starts the month at Kyiv midnight", () => {
    expect(kyivMonthStart(NOW).toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });
});

describe("FX trade input", () => {
  const base = { instrument: "eurusd", side: "buy", closedAt: "2026-10-02T10:00:00Z", pnl: "12.5" };

  it("accepts a minimal trade and normalises it", () => {
    const parsed = fxTradeInputSchema.parse(base);
    expect(parsed.side).toBe("BUY");
    expect(parsed.pnl).toBe("12.5");
    expect(parsed.externalId).toBeNull();
  });

  it("accepts the initial stop-loss and risk, and rejects a negative risk", () => {
    const parsed = fxTradeInputSchema.parse({ ...base, stopLoss: "4122.94", riskAmount: 2.48 });
    expect(parsed.stopLoss).toBe("4122.94");
    expect(parsed.riskAmount).toBe("2.48");
    expect(fxTradeInputSchema.safeParse({ ...base, riskAmount: "-1" }).success).toBe(false);
    expect(fxTradeInputSchema.parse(base).riskAmount).toBeUndefined();
  });

  it("turns JSON numbers and commas into decimal strings", () => {
    expect(fxTradeInputSchema.parse({ ...base, pnl: -40.25 }).pnl).toBe("-40.25");
    expect(fxTradeInputSchema.parse({ ...base, pnl: "1 250,50" }).pnl).toBe("1250.50");
  });

  it("rejects nonsense", () => {
    expect(fxTradeInputSchema.safeParse({ ...base, side: "long" }).success).toBe(false);
    expect(fxTradeInputSchema.safeParse({ ...base, pnl: "abc" }).success).toBe(false);
    expect(fxTradeInputSchema.safeParse({ ...base, instrument: "EUR USD; DROP" }).success).toBe(false);
    expect(fxTradeInputSchema.safeParse({ ...base, lots: "-1" }).success).toBe(false);
  });

  it("rejects a trade closed in the future or opened after it closed", () => {
    expect(fxTradeInputSchema.safeParse({ ...base, closedAt: "2099-01-01T00:00:00Z" }).success).toBe(false);
    expect(fxTradeInputSchema.safeParse({ ...base, openedAt: "2026-10-03T00:00:00Z" }).success).toBe(false);
  });
});

describe("FX R multiples and periods", () => {
  const withRisk = (id: string, pnl: string, risk: string | null, closedAt: string, instrument = "GOLD") => ({
    id, instrument, side: "BUY" as const, pnl, riskAmount: risk, closedAt: new Date(closedAt)
  });
  const trades = [
    withRisk("1", "-4.40", "4.31", "2026-10-13T07:43:00Z"),
    withRisk("2", "13.74", "14.21", "2026-10-14T10:23:00Z"),
    withRisk("3", "10", null, "2026-10-15T10:00:00Z"),
    withRisk("4", "20", "10", "2026-09-30T22:30:00Z"),
    withRisk("5", "-10", "5", "2026-09-15T10:00:00Z")
  ];
  const stats = summarizeFx(trades, new Date("2026-10-21T12:00:00Z"));

  it("divides net pnl by the initial risk and leaves unknown risk empty", () => {
    expect(tradeR("-4.40", "4.31")).toBe("-1.02");
    expect(tradeR("14", "2.77")).toBe("5.05");
    expect(tradeR("10", null)).toBeNull();
    expect(rOf({ pnl: "10", riskAmount: "0" })).toBeNull();
  });

  it("groups by Kyiv month, newest first, with a cross-midnight trade landing in October", () => {
    expect(stats.byMonth.map((month) => [month.key, month.count, month.pnl])).toEqual([
      ["2026-10", 4, "39.34"],
      ["2026-09", 1, "-10"]
    ]);
  });

  it("totals R only over trades with a known risk", () => {
    const october = stats.byMonth[0];
    expect(october.rCount).toBe(3);
    expect(october.sumR).toBe("1.95");
    expect(stats.allTime).toMatchObject({ key: "all", count: 5, rCount: 4, sumR: "-0.05", pnl: "29.34" });
  });

  it("reports win rate and the best and worst trade per period and for all time", () => {
    expect(stats.allTime).toMatchObject({ wins: 3, losses: 2, winRate: 60 });
    expect(stats.allTime.best).toMatchObject({ pnl: "20", r: "2" });
    expect(stats.allTime.worst).toMatchObject({ pnl: "-10", r: "-2" });
    expect(stats.byMonth[0].worst).toMatchObject({ pnl: "-4.4", r: "-1.02" });
  });

  it("lists every trade, newest first, with its R", () => {
    expect(stats.trades.map((trade) => [trade.id, trade.r])).toEqual([["3", null], ["2", "0.97"], ["1", "-1.02"], ["4", "2"], ["5", "-2"]]);
  });

  it("is consistent: month totals add up to the all-time total", () => {
    const sum = stats.byMonth.reduce((total, month) => total + Number(month.pnl), 0);
    expect(sum).toBeCloseTo(Number(stats.allTime.pnl), 6);
    expect(stats.byMonth.reduce((total, month) => total + month.count, 0)).toBe(stats.allTime.count);
  });

  it("handles no trades", () => {
    const empty = summarizeFx([], new Date("2026-10-21T12:00:00Z"));
    expect(empty.byMonth).toEqual([]);
    expect(empty.allTime).toMatchObject({ count: 0, pnl: "0", sumR: "0", best: null, worst: null });
  });
});

describe("FX broker flows", () => {
  it("nets deposits against withdrawals, newest first", () => {
    const flows = summarizeFxFlows([
      { id: "a", direction: "deposit", amount: "510.00", date: new Date("2026-10-01T17:28:13Z") },
      { id: "b", direction: "withdraw", amount: "15", date: new Date("2026-10-10T16:35:40Z") }
    ]);
    expect(flows).toMatchObject({ deposited: "510", withdrawn: "15", net: "495" });
    expect(flows.items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
