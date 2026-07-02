import { describe, expect, it } from "vitest";
import { allocationIsValid, arbitrageProfit, percent, resaleGrossResult, steamFrozenCapital, withdrawalLoss } from "@/lib/steam-calculations";

describe("Steam calculations", () => {
  it("calculates frozen Steam capital without software balance", () => {
    expect(steamFrozenCapital({ activeResale: "100", activeArbitrage: "250", openResiduals: "15" }).toString()).toBe("365");
  });

  it("calculates withdrawal loss and percent", () => {
    const loss = withdrawalLoss("200", "170");
    expect(loss.toString()).toBe("30");
    expect(percent(loss, "200").toString()).toBe("15");
  });

  it("calculates resale gross result from snapshots and flows", () => {
    expect(resaleGrossResult({ endingBalance: "1250", softwareSpent: "200", startingBalance: "1000", receivedSteamAmount: "300" }).toString()).toBe("150");
  });

  it("calculates arbitrage profit with expenses and withdrawn residuals", () => {
    expect(arbitrageProfit({ finalAmountReceived: "560", investedAmount: "500", expenses: "20", withdrawnResiduals: "10" }).toString()).toBe("50");
  });

  it("validates allocation totals", () => {
    expect(allocationIsValid("100", "0")).toBe(true);
    expect(allocationIsValid("0", "100")).toBe(true);
    expect(allocationIsValid("50", "50")).toBe(true);
    expect(allocationIsValid("70", "30")).toBe(true);
    expect(allocationIsValid("70", "20")).toBe(false);
  });
});
