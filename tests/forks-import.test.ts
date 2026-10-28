import { describe, expect, it } from "vitest";
import { buildForksImportPlan, forkFromJournal, journalAmount, journalPlacedAt } from "@/lib/forks-import";
import type { JournalFork } from "@/lib/forks-import";
import { summarizeForks } from "@/lib/forks-stats";
import { D } from "@/lib/money";

const NOW = new Date("2026-10-28T18:00:00Z");
const journal: Record<string, JournalFork> = {
  a1: { id: "a1", date: "28.10", time: "17:58", sport: "CS2", match: "HOTU — GamerLegion", status: "settled", pnl: 0.34, total: 15.17, tags: ["П1 на карте 1", "лайв"],
    legs: [{ bk: "1win", pick: "HOTU", odds: 2.35, amt: "6.60 USDT" }, { bk: "Polymarket", pick: "GamerLegion", odds: 1.78, amt: "$8.57" }] },
  b2: { id: "b2", date: "27.10", time: "09:05", sport: "CS2", match: "A — B", status: "settled", pnl: -0.2, total: 10,
    legs: [{ bk: "1win", pick: "A", odds: 2, amt: "5.00 USDT" }, { bk: "Polymarket", pick: "B", odds: 2, amt: "$5.00" }] },
  c3: { id: "c3", date: "28.10", time: "19:30", match: "C — D", status: "open", guar: 0.1, total: 12,
    legs: [{ bk: "1win", pick: "C", odds: 2, amt: "6.00 USDT" }, { bk: "Polymarket", pick: "D", odds: 2, amt: "$6.00" }] }
};

describe("journal import", () => {
  it("parses amounts", () => {
    expect(journalAmount("6.60 USDT")).toBe("6.60");
    expect(journalAmount("$8.57")).toBe("8.57");
    expect(() => journalAmount("n/a")).toThrow();
  });

  it("reads Kyiv wall-clock time (EEST before 25 Oct, EET after)", () => {
    expect(journalPlacedAt("28.10", "17:58", NOW).toISOString()).toBe("2026-10-28T15:58:00.000Z");
    expect(journalPlacedAt("20.10", "12:00", NOW).toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  it("falls back to the previous year for a date in the future", () => {
    expect(journalPlacedAt("30.12", "10:00", NOW).getUTCFullYear()).toBe(2025);
  });

  it("converts a fork keeping the journal id as externalId", () => {
    const parsed = forkFromJournal(journal.a1, NOW);
    expect(parsed).toMatchObject({ externalId: "a1", status: "SETTLED", pnl: "0.34", total: "15.17" });
    expect(parsed.legs[0]).toMatchObject({ book: "1win", stake: "6.60" });
    expect(forkFromJournal(journal.c3, NOW)).toMatchObject({ status: "OPEN", guaranteed: "0.1", pnl: null });
  });

  it("plans oldest first and agrees with the journal total", () => {
    const plan = buildForksImportPlan(journal, NOW);
    expect(plan.map((f) => f.externalId)).toEqual(["b2", "a1", "c3"]);
    const total = plan.filter((f) => f.status === "SETTLED").reduce((sum, f) => sum.plus(D(f.pnl as string)), D(0));
    expect(total.toString()).toBe("0.14");
    const stats = summarizeForks(plan.map((f, i) => ({
      id: String(i), status: f.status, placedAt: f.placedAt, match: f.match, leg1Book: f.legs[0].book, leg1Pick: f.legs[0].pick, leg1Odds: f.legs[0].odds, leg1Stake: f.legs[0].stake,
      leg2Book: f.legs[1].book, leg2Pick: f.legs[1].pick, leg2Odds: f.legs[1].odds, leg2Stake: f.legs[1].stake, total: f.total as string, pnl: f.pnl, guaranteed: f.guaranteed
    })));
    expect(stats.pnl).toBe("0.14");
    expect(stats.open.count).toBe(1);
  });
});
