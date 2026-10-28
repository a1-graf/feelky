import { describe, expect, it } from "vitest";
import { bagiraFee, netOf } from "@/lib/forks-config";
import { forkInputSchema } from "@/lib/forks-input";
import { buildForkSeries, inRange, summarizeForks, weekStart } from "@/lib/forks-stats";
import type { ForkLike } from "@/lib/forks-stats";

const fork = (id: string, placedAt: string, pnl: string | null, total = "10", status: "OPEN" | "SETTLED" = "SETTLED", guaranteed: string | null = null): ForkLike => ({
  id, status, placedAt: new Date(placedAt), match: `Match ${id}`, sport: "CS2", tags: ["лайв"],
  leg1Book: "1win", leg1Pick: "A", leg1Odds: "2", leg1Stake: "5", leg2Book: "Polymarket", leg2Pick: "B", leg2Odds: "2", leg2Stake: "5",
  total, pnl, guaranteed
});

describe("Bagira fee", () => {
  it("takes 40% of profit and nothing of a loss", () => {
    expect(bagiraFee("10").toString()).toBe("4");
    expect(netOf("10").toString()).toBe("6");
    expect(bagiraFee("-3").toString()).toBe("0");
    expect(netOf("-3").toString()).toBe("-3");
    expect(bagiraFee("0.35").toString()).toBe("0.14");
  });
});

describe("fork statistics", () => {
  const forks = [
    fork("1", "2026-10-26T10:00:00Z", "0.50", "10"),
    fork("2", "2026-10-27T10:00:00Z", "-0.20", "20"),
    fork("3", "2026-10-28T10:00:00Z", "0.34", "15"),
    fork("4", "2026-10-28T12:00:00Z", null, "12", "OPEN", "0.10")
  ];
  const stats = summarizeForks(forks);

  it("sums decimals exactly and keeps open forks out of the result", () => {
    expect(stats.count).toBe(3);
    expect(stats.pnl).toBe("0.64");
    expect(stats.turnover).toBe("45");
    expect(summarizeForks([fork("a", "2026-10-01T10:00:00Z", "0.1"), fork("b", "2026-10-01T11:00:00Z", "0.2")]).pnl).toBe("0.3");
  });

  it("computes win rate, average and weighted percent", () => {
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe("66.67");
    expect(stats.avgPercent).toBe("2.09");
    expect(stats.weightedPercent).toBe("1.42");
  });

  it("splits Bagira's fee off the period profit", () => {
    expect(stats.bagiraFee).toBe("0.26");
    expect(stats.net).toBe("0.38");
    expect(summarizeForks([fork("l", "2026-10-01T10:00:00Z", "-1")]).bagiraFee).toBe("0");
  });

  it("reports open forks separately", () => {
    expect(stats.open).toMatchObject({ count: 1, stake: "12", guaranteed: "0.1" });
    expect(stats.open.items[0].guaranteed).toBe("0.1");
    expect(stats.settled).toHaveLength(3);
  });

  it("builds daily and weekly dynamics, newest first", () => {
    expect(stats.byDay.map((d) => d.key)).toEqual(["2026-10-28", "2026-10-27", "2026-10-26"]);
    expect(stats.byDay[0]).toMatchObject({ count: 1, pnl: "0.34", cumulative: "0.64" });
    expect(stats.byWeek).toHaveLength(1);
    expect(stats.byWeek[0]).toMatchObject({ key: "2026-10-26", count: 3, pnl: "0.64" });
    expect(stats.timeline.map((p) => p.net)).toEqual([0.5, 0.3, 0.64]);
  });

  it("finds the best and worst fork", () => {
    expect(stats.best?.pnl).toBe("0.5");
    expect(stats.worst?.pnl).toBe("-0.2");
  });

  it("is empty-safe", () => {
    const empty = summarizeForks([]);
    expect(empty).toMatchObject({ count: 0, pnl: "0", winRate: "0", avgPercent: "0", weightedPercent: "0", net: "0" });
  });

  it("filters by period and builds the running series", () => {
    const range = { gte: new Date("2026-10-27T00:00:00Z"), lte: new Date("2026-10-28T23:59:59Z") };
    expect(inRange(forks, range)).toHaveLength(3);
    expect(buildForkSeries(forks).map((p) => p.balance)).toEqual([0.5, 0.3, 0.64]);
  });

  it("uses Kyiv days: 23:30 UTC belongs to the next Kyiv day", () => {
    expect(summarizeForks([fork("k", "2026-10-27T22:30:00Z", "1")]).byDay[0].key).toBe("2026-10-28");
  });

  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-28")).toBe("2026-10-26");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });
});

describe("fork input", () => {
  const base = {
    externalId: "cf936d0fdf9b", status: "settled", placedAt: "2026-10-28T17:58:00+02:00", match: "HOTU — GamerLegion",
    legs: [{ book: "1win", pick: "HOTU", odds: 2.35, stake: "6.60" }, { book: "Polymarket", pick: "GamerLegion", odds: "1,78", stake: "8.57" }], pnl: "0.34"
  };

  it("accepts a settled fork and normalizes numbers", () => {
    const parsed = forkInputSchema.parse(base);
    expect(parsed.status).toBe("SETTLED");
    expect(parsed.legs[0].odds).toBe("2.35");
    expect(parsed.legs[1].odds).toBe("1.78");
    expect(parsed.tags).toEqual([]);
  });

  it("needs pnl for a settled fork but not for an open one", () => {
    expect(forkInputSchema.safeParse({ ...base, pnl: undefined }).success).toBe(false);
    expect(forkInputSchema.safeParse({ ...base, status: "open", pnl: undefined, guaranteed: "0.10" }).success).toBe(true);
  });

  it("rejects two legs missing, bad odds and a future fork", () => {
    expect(forkInputSchema.safeParse({ ...base, legs: [base.legs[0]] }).success).toBe(false);
    expect(forkInputSchema.safeParse({ ...base, legs: [{ ...base.legs[0], odds: "0" }, base.legs[1]] }).success).toBe(false);
    expect(forkInputSchema.safeParse({ ...base, placedAt: "2099-01-01T00:00:00Z" }).success).toBe(false);
  });
});
