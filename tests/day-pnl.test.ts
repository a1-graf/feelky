import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { kyivDayKey, lastDaysPnl } from "@/lib/day-pnl";
import { steamProfitParts } from "@/lib/steam";

const now = new Date("2026-11-09T10:00:00.000Z");
const dec = (value: string) => new Prisma.Decimal(value);

describe("day pnl", () => {
  it("keeps the last 7 Kyiv days oldest first, sums each day and zero-fills gaps", () => {
    const days = lastDaysPnl(
      [
        { date: "2026-11-09", pnl: "1.105" },
        { date: "2026-11-09", pnl: -0.5 },
        { date: "2026-11-05", pnl: "-3" },
        { date: "2026-11-02", pnl: "100" }
      ],
      7,
      now
    );
    expect(days.map((day) => day.date)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]);
    expect(days.at(-1)?.pnl).toBe("0.61");
    expect(days[2].pnl).toBe("-3");
    expect(days[0].pnl).toBe("0");
  });

  it("assigns late-evening UTC instants to the next Kyiv day", () => {
    expect(kyivDayKey(new Date("2026-11-08T22:30:00.000Z"))).toBe("2026-11-09");
  });

  it("splits steam profit by day with the dashboard formula", () => {
    const rows = {
      expenseAllocations: [
        { arbitrageRoundId: null, resalePercent: dec("50"), arbitragePercent: dec("50"), expenseTransaction: { amount: dec("10"), archivedAt: null, transactionDate: new Date("2026-11-08T09:00:00Z") } }
      ],
      resaleWithdrawals: [{ amountReceived: dec("30"), withdrawalDate: new Date("2026-11-09T09:00:00Z") }],
      completedRounds: [{ id: "r", investedAmount: dec("100"), finalAmountReceived: dec("112"), completedAt: new Date("2026-11-08T12:00:00Z") }],
      withdrawnResiduals: []
    };
    const on = (key: string) => (date?: Date | null) => Boolean(date) && kyivDayKey(date as Date) === key;
    const day8 = steamProfitParts(rows, on("2026-11-08"));
    const day9 = steamProfitParts(rows, on("2026-11-09"));
    expect(day8.resaleProfit.plus(day8.arbitrageProfit).toString()).toBe("2");
    expect(day9.resaleProfit.plus(day9.arbitrageProfit).toString()).toBe("30");
  });
});
