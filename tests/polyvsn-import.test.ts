import { describe, expect, it } from "vitest";
import { buildPolyvsnPlan, summarizePolyvsnPlan } from "@/lib/polyvsn-import";
import { summarizePoly } from "@/lib/poly-stats";
import { polyTradeInputSchema } from "@/lib/poly-input";

describe("Polyvsn import plan", () => {
  const plan = buildPolyvsnPlan();

  it("has a unique stable id for every trade and flow", () => {
    expect(plan.trades).toHaveLength(26);
    const ids = [...plan.trades.map((trade) => trade.externalId), ...plan.flows.map((flow) => flow.importId)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildPolyvsnPlan().trades.map((trade) => trade.externalId)).toEqual(plan.trades.map((trade) => trade.externalId));
  });

  it("tags every trade with its Polymarket account (8 on @11121f, 18 on @55011)", () => {
    const count = (ref: string) => plan.trades.filter((trade) => trade.walletRef === ref).length;
    expect(count("@11121f")).toBe(8);
    expect(count("@55011")).toBe(18);
    expect(plan.trades.find((trade) => trade.marketSlug === "btc-updown-5m-1792511700")?.walletRef).toBe("@11121f");
  });

  it("passes the trade input schema and splits the sections", () => {
    for (const trade of plan.trades) {
      const parsed = polyTradeInputSchema.safeParse({ ...trade, pnl: trade.pnl });
      expect(parsed.success, trade.externalId).toBe(true);
    }
    const stats = summarizePoly(
      plan.trades.map((trade) => ({ ...trade, id: trade.externalId, entryPrice: String(trade.entryPrice), sizeUsd: String(trade.sizeUsd), pnlUsd: String(trade.pnl), resolvedAt: trade.resolvedAt ?? null })) as never,
      new Date("2026-10-21T00:00:00Z")
    );
    expect(stats.count).toBe(26);
    expect(stats.bySection.find((row) => row.name === "MANUAL")?.pnl).toBe("-14.29");
    expect(stats.bySection.find((row) => row.name === "COPYTRADE")?.pnl).toBe("-42.62");
  });

  it("ends at 52.63 available + 250.77 locked, total PnL -28.63", () => {
    expect(summarizePolyvsnPlan(plan)).toEqual({
      pool: "52.63",
      locked: "250.77",
      netContributed: "332.03",
      tradesPnl: "-56.91",
      unattributed: "28.28",
      totalPnl: "-28.63"
    });
  });
});
