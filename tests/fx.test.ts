import { describe, expect, it } from "vitest";
import { fxTradeInputSchema } from "@/lib/fx-input";
import { kyivMonthStart, summarizeFx } from "@/lib/fx-stats";

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
