import { describe, expect, it } from "vitest";
import { agentOperationSchema } from "@/lib/agent-operations";
import { polyLockInputSchema, polyReleaseInputSchema, polyTradeInputSchema } from "@/lib/poly-input";
import { computePolyPnl, inferMarketKind, priceBucketOf, reconcilePool, summarizePoly, summarizeSlippage, weekStartKey } from "@/lib/poly-stats";
import type { PolyTradeLike } from "@/lib/poly-stats";
import { isPolyLedgerTransaction } from "@/lib/transaction-utils";

const NOW = new Date("2026-10-14T12:00:00.000Z");

let counter = 0;
function trade(overrides: Partial<PolyTradeLike> & { pnlUsd: string }): PolyTradeLike {
  counter += 1;
  return {
    id: `t${counter}`,
    externalId: `e${counter}`,
    section: "MANUAL",
    agentName: null,
    marketSlug: "btc-updown-5m-1",
    title: "BTC up or down",
    marketKind: "BTC_5M",
    outcome: "Up",
    entryPrice: "0.5",
    sizeUsd: "10",
    feesUsd: "0",
    status: overrides.pnlUsd.startsWith("-") ? "LOST" : "WON",
    openedAt: new Date("2026-10-13T10:15:00.000Z"),
    resolvedAt: new Date("2026-10-13T10:20:00.000Z"),
    ...overrides
  };
}

describe("Polymarket PnL", () => {
  it("pays 1 per share on a win, loses the stake on a loss, returns it on void", () => {
    expect(computePolyPnl({ status: "WON", entryPrice: "0.4", sizeUsd: "10", feesUsd: "0" }).toString()).toBe("15");
    expect(computePolyPnl({ status: "WON", entryPrice: "0.4", sizeUsd: "10", shares: "25", feesUsd: "0.5" }).toString()).toBe("14.5");
    expect(computePolyPnl({ status: "LOST", entryPrice: "0.4", sizeUsd: "10", feesUsd: "0.1" }).toString()).toBe("-10.1");
    expect(computePolyPnl({ status: "VOID", entryPrice: "0.4", sizeUsd: "10", feesUsd: "0" }).toString()).toBe("0");
    expect(computePolyPnl({ status: "OPEN", entryPrice: "0.4", sizeUsd: "10" }).toString()).toBe("0");
  });

  it("infers the market kind from the slug", () => {
    expect(inferMarketKind("btc-updown-5m-1760000000")).toBe("BTC_5M");
    expect(inferMarketKind("btc-updown-15m-1760000000")).toBe("BTC_15M");
    expect(inferMarketKind("eth-updown-5m-1760000000")).toBe("ETH_5M");
    expect(inferMarketKind("ethereum-up-or-down-15-min")).toBe("ETH_15M");
    expect(inferMarketKind("will-trump-win", "Will Trump win?")).toBe("OTHER");
    expect(inferMarketKind("btc-above-100k-on-friday")).toBe("OTHER");
  });
});

describe("Polymarket trade input", () => {
  const base = { externalId: "w1-1", section: "copytrade", marketSlug: "btc-updown-5m-1760000000", outcome: "Up", entryPrice: "0,52", sizeUsd: 35, openedAt: "2026-10-13T10:15:00Z" };

  it("normalises section, price and infers the market kind and status", () => {
    const parsed = polyTradeInputSchema.parse(base);
    expect(parsed).toMatchObject({ section: "COPYTRADE", entryPrice: "0.52", sizeUsd: "35", marketKind: "BTC_5M", status: "OPEN", title: "btc-updown-5m-1760000000" });
  });

  it("takes the status from the sign of an explicit PnL", () => {
    expect(polyTradeInputSchema.parse({ ...base, pnl: "-35" }).status).toBe("LOST");
    expect(polyTradeInputSchema.parse({ ...base, pnl: "12.5" }).status).toBe("WON");
    expect(polyTradeInputSchema.parse({ ...base, status: "won" }).status).toBe("WON");
  });

  it("requires an agent name for AI agent trades and a sane price", () => {
    expect(polyTradeInputSchema.safeParse({ ...base, section: "AI_AGENT" }).success).toBe(false);
    expect(polyTradeInputSchema.parse({ ...base, section: "ai-agent", agentName: "Agent 1" }).section).toBe("AI_AGENT");
    expect(polyTradeInputSchema.safeParse({ ...base, entryPrice: "1.5" }).success).toBe(false);
    expect(polyTradeInputSchema.safeParse({ ...base, entryPrice: "0" }).success).toBe(false);
  });

  it("rejects missing externalId, zero size, future open and reversed dates", () => {
    expect(polyTradeInputSchema.safeParse({ ...base, externalId: "" }).success).toBe(false);
    expect(polyTradeInputSchema.safeParse({ ...base, sizeUsd: "0" }).success).toBe(false);
    expect(polyTradeInputSchema.safeParse({ ...base, openedAt: "2999-01-01T00:00:00Z" }).success).toBe(false);
    expect(polyTradeInputSchema.safeParse({ ...base, resolvedAt: "2026-10-13T10:00:00Z" }).success).toBe(false);
    expect(polyTradeInputSchema.safeParse({ ...base, status: "OPEN", pnl: "5" }).success).toBe(false);
  });

  it("validates lock and release input", () => {
    expect(polyLockInputSchema.parse({ amountUsd: "250", agentName: "A1" }).lockDays).toBe(30);
    expect(polyLockInputSchema.safeParse({ amountUsd: "0", agentName: "A1" }).success).toBe(false);
    expect(polyReleaseInputSchema.parse({ agentName: "A1", returnedUsd: "0" }).returnedUsd).toBe("0");
    expect(polyReleaseInputSchema.safeParse({ agentName: "A1", returnedUsd: "-1" }).success).toBe(false);
  });
});

describe("Polymarket statistics", () => {
  const trades = [
    trade({ pnlUsd: "15", entryPrice: "0.4", sizeUsd: "10", section: "COPYTRADE", signalPrice: "0.38", openedAt: new Date("2026-10-13T10:15:00Z"), resolvedAt: new Date("2026-10-13T10:20:00Z") }),
    trade({ pnlUsd: "-10", entryPrice: "0.65", sizeUsd: "10", section: "COPYTRADE", signalPrice: "0.63", openedAt: new Date("2026-10-13T11:15:00Z"), resolvedAt: new Date("2026-10-13T11:20:00Z") }),
    trade({ pnlUsd: "8", entryPrice: "0.5", sizeUsd: "10", section: "AI_AGENT", agentName: "A1", marketKind: "ETH_15M", openedAt: new Date("2026-10-12T10:00:00Z"), resolvedAt: new Date("2026-10-12T10:15:00Z") }),
    trade({ pnlUsd: "-4", entryPrice: "0.9", sizeUsd: "10", section: "MANUAL", openedAt: new Date("2026-09-28T10:00:00Z"), resolvedAt: new Date("2026-09-28T10:05:00Z") }),
    trade({ pnlUsd: "0", status: "OPEN", resolvedAt: null, sizeUsd: "35", section: "MANUAL" })
  ];
  const stats = summarizePoly(trades, NOW);

  it("sums resolved trades exactly and counts open exposure separately", () => {
    expect(stats.totalPnl).toBe("9");
    expect(stats.count).toBe(4);
    expect(stats.openCount).toBe(1);
    expect(stats.openExposure).toBe("35");
    expect(summarizePoly([trade({ pnlUsd: "0.1" }), trade({ pnlUsd: "0.2" })], NOW).totalPnl).toBe("0.3");
  });

  it("computes winrate, profit factor, averages, turnover and ROI", () => {
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.grossProfit).toBe("23");
    expect(stats.grossLoss).toBe("14");
    expect(stats.profitFactor).toBe("1.64");
    expect(stats.turnover).toBe("40");
    expect(stats.roi).toBe("22.5");
  });

  it("counts this Kyiv month and the week separately", () => {
    expect(stats.monthPnl).toBe("13");
    expect(stats.byWeek.map((row) => [row.name, row.pnl])).toEqual([["2026-10-12", "13"], ["2026-09-28", "-4"]]);
    expect(weekStartKey("2026-10-13")).toBe("2026-10-12");
    expect(weekStartKey("2026-10-11")).toBe("2026-10-05");
  });

  it("splits by section, agent, market kind, price bucket and UTC hour", () => {
    expect(stats.bySection.find((row) => row.name === "COPYTRADE")?.pnl).toBe("5");
    expect(stats.bySection.find((row) => row.name === "AI_AGENT")?.pnl).toBe("8");
    expect(stats.byAgent).toHaveLength(1);
    expect(stats.byAgent[0]).toMatchObject({ name: "A1", pnl: "8", count: 1 });
    expect(stats.byMarketKind.find((row) => row.name === "ETH_15M")?.count).toBe(1);
    expect(stats.byPriceBucket.find((row) => row.name === "40–50¢")?.pnl).toBe("15");
    expect(stats.byPriceBucket.find((row) => row.name === "80–100¢")?.pnl).toBe("-4");
    expect(stats.byHourUtc).toHaveLength(24);
    expect(stats.byHourUtc.find((row) => row.name === "10")?.count).toBe(3);
    expect(priceBucketOf("1")).toBe("80–100¢");
    expect(priceBucketOf("0.2")).toBe("20–40¢");
  });

  it("builds a cumulative daily timeline", () => {
    expect(stats.timeline.map((point) => [point.label, point.net])).toEqual([["28.09", -4], ["12.10", 4], ["13.10", 9]]);
  });

  it("measures copytrade slippage against the signal price", () => {
    const slippage = summarizeSlippage(trades);
    expect(slippage.count).toBe(2);
    expect(slippage.avgPoints).toBe("0.02");
    expect(slippage.worseCount).toBe(2);
    expect(Number(slippage.costUsd)).toBeCloseTo(0.02 * 25 + 0.02 * (10 / 0.65), 3);
    expect(summarizeSlippage([trade({ pnlUsd: "1" })]).count).toBe(0);
  });

  it("handles no trades at all", () => {
    const empty = summarizePoly([], NOW);
    expect(empty).toMatchObject({ totalPnl: "0", count: 0, winRate: 0, profitFactor: null, roi: "0" });
    expect(empty.timeline).toEqual([]);
  });
});

describe("Polymarket pool reconciliation", () => {
  it("is ok when balances and posted PnL agree", () => {
    expect(reconcilePool({ storedBalance: "100", ledgerBalance: "100", postedTradePnl: "9", tradesPnl: "9", lockedPrincipal: "250" })).toMatchObject({ ok: true, balanceDrift: "0", pnlDrift: "0" });
  });

  it("reports drift in either direction", () => {
    const result = reconcilePool({ storedBalance: "101.5", ledgerBalance: "100", postedTradePnl: "9", tradesPnl: "12", lockedPrincipal: "0" });
    expect(result).toMatchObject({ ok: false, balanceDrift: "1.5", pnlDrift: "-3" });
  });
});

describe("Polymarket agent operations and ledger rows", () => {
  it("parses pool operations", () => {
    expect(agentOperationSchema.parse({ type: "poly_deposit", amount: "52", from: "Мейн гаманець" })).toMatchObject({ amount: "52" });
    expect(agentOperationSchema.parse({ type: "poly_lock", amount: "250", agent: "Agent 1" })).toMatchObject({ agent: "Agent 1" });
    expect(agentOperationSchema.parse({ type: "poly_release", agent: "Agent 1", returned: "0" })).toMatchObject({ returned: "0" });
    expect(agentOperationSchema.safeParse({ type: "poly_deposit", amount: "0", from: "Мейн гаманець" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "poly_release", agent: "A", returned: "-5" }).success).toBe(false);
  });

  it("recognises Polymarket ledger rows by their source", () => {
    expect(isPolyLedgerTransaction({ metadata: { source: "POLY_PNL" } })).toBe(true);
    expect(isPolyLedgerTransaction({ metadata: { source: "POLY_LOCK" } })).toBe(true);
    expect(isPolyLedgerTransaction({ metadata: { source: "FX_PNL" } })).toBe(false);
    expect(isPolyLedgerTransaction({ metadata: null })).toBe(false);
  });
});
